package br.com.dumbfood.app;

import android.Manifest;
import android.annotation.SuppressLint;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.os.Build;
import androidx.core.content.ContextCompat;
import com.google.android.gms.location.Geofence;
import com.google.android.gms.location.GeofencingClient;
import com.google.android.gms.location.GeofencingRequest;
import com.google.android.gms.location.LocationServices;
import java.util.ArrayList;
import java.util.Calendar;
import java.util.List;
import org.json.JSONArray;
import org.json.JSONObject;

/**
 * Cozinha e academia como cercas de GPS (Google Play services), registradas a partir da
 * configuração que o JS grava (src/lib/lugares.ts). O sistema avisa o GeofenceReceiver ao
 * entrar/sair, mesmo com o app fechado; as cercas somem no reboot e na atualização do APK,
 * por isso o BootReceiver chama registrar() de novo.
 */
final class Lugares {

    static final String PREFS = "dumbfood_lugares";
    static final String COZINHA = "cozinha";
    static final String ACADEMIA = "academia";

    private Lugares() {}

    static SharedPreferences prefs(Context ctx) {
        return ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    static JSONObject config(Context ctx) {
        try {
            return new JSONObject(prefs(ctx).getString("config", "{}"));
        } catch (Exception e) {
            return new JSONObject();
        }
    }

    static boolean temLocalizacao(Context ctx) {
        return ContextCompat.checkSelfPermission(ctx, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED;
    }

    static boolean temSegundoPlano(Context ctx) {
        if (Build.VERSION.SDK_INT < 29) return temLocalizacao(ctx);
        return ContextCompat.checkSelfPermission(ctx, Manifest.permission.ACCESS_BACKGROUND_LOCATION) == PackageManager.PERMISSION_GRANTED;
    }

    private static PendingIntent pendente(Context ctx) {
        Intent i = new Intent(ctx, GeofenceReceiver.class);
        int flags = PendingIntent.FLAG_UPDATE_CURRENT;
        // Play services preenche o intent com o evento: precisa ser mutável a partir do S.
        if (Build.VERSION.SDK_INT >= 31) flags |= PendingIntent.FLAG_MUTABLE;
        return PendingIntent.getBroadcast(ctx, 0, i, flags);
    }

    /** Cerca de um lugar ligado e com coordenadas; null quando não vale registrar. */
    private static Geofence cerca(JSONObject cfg, String id, int transicoes, float raioPadrao) {
        JSONObject l = cfg.optJSONObject(id);
        if (l == null || !l.optBoolean("ativo") || !l.has("lat") || !l.has("lng")) return null;
        Geofence.Builder b = new Geofence.Builder()
            .setRequestId(id)
            .setCircularRegion(l.optDouble("lat"), l.optDouble("lng"), (float) l.optDouble("raio", raioPadrao))
            .setExpirationDuration(Geofence.NEVER_EXPIRE)
            .setTransitionTypes(transicoes);
        // Na cozinha, só conta quem fica um minuto: o GPS dentro de casa oscila e passar
        // pela porta não é estar comendo.
        if ((transicoes & Geofence.GEOFENCE_TRANSITION_DWELL) != 0) b.setLoiteringDelay(60_000);
        return b.build();
    }

    /** Refaz as cercas do zero a partir da configuração gravada. */
    @SuppressLint("MissingPermission")
    static void registrar(Context ctx) {
        GeofencingClient cliente = LocationServices.getGeofencingClient(ctx);
        PendingIntent pi = pendente(ctx);
        cliente.removeGeofences(pi);
        if (!temLocalizacao(ctx) || !temSegundoPlano(ctx)) return;
        JSONObject cfg = config(ctx);
        List<Geofence> cercas = new ArrayList<>();
        Geofence c = cerca(cfg, COZINHA, Geofence.GEOFENCE_TRANSITION_DWELL, 25f);
        if (c != null) cercas.add(c);
        Geofence a = cerca(cfg, ACADEMIA, Geofence.GEOFENCE_TRANSITION_EXIT, 80f);
        if (a != null) cercas.add(a);
        if (cercas.isEmpty()) return;
        // Sem gatilho inicial: ligar a função estando na cozinha não dispara o alarme.
        GeofencingRequest req = new GeofencingRequest.Builder().setInitialTrigger(0).addGeofences(cercas).build();
        try {
            cliente.addGeofences(req, pi);
        } catch (SecurityException e) {
            // permissão revogada entre a checagem e o pedido: fica sem cerca até o próximo configurar
        }
    }

    /** Minutos desde a meia-noite de "HH:MM". */
    static int minutos(String hhmm, int padrao) {
        try {
            String[] p = hhmm.split(":");
            return Integer.parseInt(p[0]) * 60 + Integer.parseInt(p[1]);
        } catch (Exception e) {
            return padrao;
        }
    }

    static int agoraEmMinutos() {
        Calendar c = Calendar.getInstance();
        return c.get(Calendar.HOUR_OF_DAY) * 60 + c.get(Calendar.MINUTE);
    }

    /** Janela do dia; atravessa a meia-noite quando o fim vem antes do início. */
    static boolean dentroDoHorario(String inicio, String fim) {
        int i = minutos(inicio, 6 * 60), f = minutos(fim, 23 * 60 + 30), m = agoraEmMinutos();
        return i <= f ? m >= i && m <= f : m >= i || m <= f;
    }

    static List<String> acabando(Context ctx) {
        List<String> out = new ArrayList<>();
        try {
            JSONArray a = new JSONArray(prefs(ctx).getString("acabando", "[]"));
            for (int i = 0; i < a.length(); i++) out.add(a.getString(i));
        } catch (Exception e) {
            // sem lista: nada acabando
        }
        return out;
    }

    /** Hoje é dia de hortifrúti (0 = domingo, como no JS)? */
    static boolean diaDeHortifruti(JSONObject cfg) {
        JSONObject h = cfg.optJSONObject("hortifruti");
        if (h == null || !h.optBoolean("ativo")) return false;
        JSONArray dias = h.optJSONArray("dias");
        if (dias == null) return false;
        int hoje = Calendar.getInstance().get(Calendar.DAY_OF_WEEK) - 1;
        for (int i = 0; i < dias.length(); i++) if (dias.optInt(i, -1) == hoje) return true;
        return false;
    }
}
