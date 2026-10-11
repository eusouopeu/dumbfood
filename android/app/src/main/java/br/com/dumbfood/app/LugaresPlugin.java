package br.com.dumbfood.app;

import android.Manifest;
import android.annotation.SuppressLint;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import androidx.core.app.ActivityCompat;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import com.google.android.gms.common.ConnectionResult;
import com.google.android.gms.common.GoogleApiAvailability;
import com.google.android.gms.location.LocationServices;
import com.google.android.gms.location.Priority;
import com.google.android.gms.tasks.CancellationTokenSource;

/**
 * Ponte de src/lib/lugares.ts: permissões de localização, posição atual (para marcar
 * cozinha e academia), configuração das cercas e o que o aviso de mercado precisa saber
 * (itens acabando, último registro de refeição) gravados em SharedPreferences.
 */
@CapacitorPlugin(
    name = "Lugares",
    permissions = { @Permission(alias = "localizacao", strings = { Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION }) }
)
public class LugaresPlugin extends Plugin {

    @PluginMethod
    public void estado(PluginCall call) {
        Context ctx = getContext();
        JSObject r = new JSObject();
        r.put("localizacao", Lugares.temLocalizacao(ctx));
        r.put("segundoPlano", Lugares.temSegundoPlano(ctx));
        r.put("playServices", GoogleApiAvailability.getInstance().isGooglePlayServicesAvailable(ctx) == ConnectionResult.SUCCESS);
        call.resolve(r);
    }

    @PluginMethod
    public void pedirLocalizacao(PluginCall call) {
        if (getPermissionState("localizacao") == PermissionState.GRANTED) {
            estado(call);
            return;
        }
        requestPermissionForAlias("localizacao", call, "depoisDaLocalizacao");
    }

    @PermissionCallback
    private void depoisDaLocalizacao(PluginCall call) {
        estado(call);
    }

    /**
     * "Permitir o tempo todo": no Android 11+ o sistema só concede na tela de ajustes do app;
     * o pedido abaixo leva até lá. O JS confere de novo quando o app volta à frente.
     */
    @PluginMethod
    public void pedirSegundoPlano(PluginCall call) {
        if (Build.VERSION.SDK_INT >= 29 && !Lugares.temSegundoPlano(getContext())) {
            ActivityCompat.requestPermissions(getActivity(), new String[] { Manifest.permission.ACCESS_BACKGROUND_LOCATION }, 7301);
        }
        call.resolve();
    }

    @PluginMethod
    public void abrirAjustes(PluginCall call) {
        Intent i = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.fromParts("package", getContext().getPackageName(), null));
        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        getContext().startActivity(i);
        call.resolve();
    }

    @SuppressLint("MissingPermission")
    @PluginMethod
    public void posicaoAtual(PluginCall call) {
        if (!Lugares.temLocalizacao(getContext())) {
            call.reject("sem permissão de localização");
            return;
        }
        LocationServices.getFusedLocationProviderClient(getContext())
            .getCurrentLocation(Priority.PRIORITY_HIGH_ACCURACY, new CancellationTokenSource().getToken())
            .addOnSuccessListener(loc -> {
                if (loc == null) {
                    call.reject("sem sinal de GPS agora");
                    return;
                }
                JSObject r = new JSObject();
                r.put("lat", loc.getLatitude());
                r.put("lng", loc.getLongitude());
                r.put("precisao", loc.getAccuracy());
                call.resolve(r);
            })
            .addOnFailureListener(e -> call.reject(e.getMessage()));
    }

    /** Grava a configuração (JSON de lib/lugares.ts) e refaz as cercas. */
    @PluginMethod
    public void configurar(PluginCall call) {
        Lugares.prefs(getContext()).edit().putString("config", call.getString("json", "{}")).apply();
        Lugares.registrar(getContext());
        call.resolve();
    }

    /** O que os avisos consultam sem abrir o app: itens acabando e o último registro de refeição. */
    @PluginMethod
    public void publicarEstado(PluginCall call) {
        JSArray acabando = call.getArray("acabando", new JSArray());
        Lugares.prefs(getContext())
            .edit()
            .putString("acabando", acabando.toString())
            .putLong("ultimoRegistro", call.getLong("ultimoRegistro", 0L))
            .apply();
        call.resolve();
    }

    /** Prova do aviso da cozinha (notificação ou alarme), para o Pedro ouvir como fica. */
    @PluginMethod
    public void testarAviso(PluginCall call) {
        Context ctx = getContext();
        if ("alarme".equals(call.getString("modo"))) {
            Intent s = new Intent(ctx, AlarmeService.class);
            if (Build.VERSION.SDK_INT >= 26) ctx.startForegroundService(s);
            else ctx.startService(s);
        } else if ("mercado".equals(call.getString("modo"))) {
            Avisos.mercado(ctx, "Exemplo: acabando arroz, leite. Hoje é dia de hortifrúti.");
        } else {
            Avisos.cozinha(ctx);
        }
        call.resolve();
    }

    @PluginMethod
    public void desligarAlarme(PluginCall call) {
        getContext().stopService(new Intent(getContext(), AlarmeService.class));
        call.resolve();
    }
}
