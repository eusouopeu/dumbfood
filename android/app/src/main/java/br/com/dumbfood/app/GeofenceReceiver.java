package br.com.dumbfood.app;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;
import com.google.android.gms.location.Geofence;
import com.google.android.gms.location.GeofencingEvent;
import java.util.List;
import org.json.JSONObject;

/**
 * Chega aqui o que o Play services detecta nas cercas (Lugares.java):
 * - ficou na cozinha → lembrete de registrar o que está comendo (notificação ou alarme);
 * - saiu da academia → "passe no mercado", se algo da despensa está acabando ou é dia de
 *   hortifrúti.
 * Cada aviso tem intervalo mínimo, para o GPS oscilando dentro de casa não virar sirene.
 */
public class GeofenceReceiver extends BroadcastReceiver {

    private static final long MIN = 60_000L;

    @Override
    public void onReceive(Context ctx, Intent intent) {
        GeofencingEvent ev = GeofencingEvent.fromIntent(intent);
        if (ev == null || ev.hasError() || ev.getTriggeringGeofences() == null) return;
        int t = ev.getGeofenceTransition();
        JSONObject cfg = Lugares.config(ctx);
        for (Geofence g : ev.getTriggeringGeofences()) {
            String id = g.getRequestId();
            if (Lugares.COZINHA.equals(id) && (t == Geofence.GEOFENCE_TRANSITION_DWELL || t == Geofence.GEOFENCE_TRANSITION_ENTER)) {
                naCozinha(ctx, cfg.optJSONObject(Lugares.COZINHA));
            } else if (Lugares.ACADEMIA.equals(id) && t == Geofence.GEOFENCE_TRANSITION_EXIT) {
                saiuDaAcademia(ctx, cfg);
            }
        }
    }

    private static boolean podeAvisar(SharedPreferences p, String chave, long intervaloMs) {
        long ultimo = p.getLong(chave, 0);
        return System.currentTimeMillis() - ultimo >= intervaloMs;
    }

    private void naCozinha(Context ctx, JSONObject c) {
        if (c == null || !c.optBoolean("ativo")) return;
        if (!Lugares.dentroDoHorario(c.optString("inicio", "06:00"), c.optString("fim", "23:30"))) return;
        SharedPreferences p = Lugares.prefs(ctx);
        if (!podeAvisar(p, "ultimoAvisoCozinha", c.optInt("intervaloMin", 90) * MIN)) return;
        // Acabou de registrar uma refeição: não precisa lembrar.
        if (System.currentTimeMillis() - p.getLong("ultimoRegistro", 0) < 30 * MIN) return;
        p.edit().putLong("ultimoAvisoCozinha", System.currentTimeMillis()).apply();
        if ("alarme".equals(c.optString("modo"))) {
            Intent s = new Intent(ctx, AlarmeService.class);
            if (Build.VERSION.SDK_INT >= 26) ctx.startForegroundService(s);
            else ctx.startService(s);
        } else {
            Avisos.cozinha(ctx);
        }
    }

    private void saiuDaAcademia(Context ctx, JSONObject cfg) {
        JSONObject a = cfg.optJSONObject(Lugares.ACADEMIA);
        if (a == null || !a.optBoolean("ativo")) return;
        SharedPreferences p = Lugares.prefs(ctx);
        if (!podeAvisar(p, "ultimoAvisoMercado", 6 * 60 * MIN)) return;
        List<String> acabando = Lugares.acabando(ctx);
        boolean hortifruti = Lugares.diaDeHortifruti(cfg);
        if (acabando.isEmpty() && !hortifruti) return;
        p.edit().putLong("ultimoAvisoMercado", System.currentTimeMillis()).apply();
        StringBuilder corpo = new StringBuilder();
        if (!acabando.isEmpty()) {
            corpo.append("Acabando: ");
            for (int i = 0; i < Math.min(acabando.size(), 5); i++) corpo.append(i > 0 ? ", " : "").append(acabando.get(i));
            if (acabando.size() > 5) corpo.append(" e mais ").append(acabando.size() - 5);
            corpo.append(".");
        }
        if (hortifruti) {
            JSONObject h = cfg.optJSONObject("hortifruti");
            String mercado = h != null ? h.optString("mercado", "") : "";
            if (corpo.length() > 0) corpo.append(" ");
            corpo.append("Hoje é dia de hortifrúti").append(mercado.isEmpty() ? "" : " no " + mercado).append(".");
        }
        Avisos.mercado(ctx, corpo.toString());
    }
}
