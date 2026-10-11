package br.com.dumbfood.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.media.AudioAttributes;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;

/** Canais e notificações dos avisos por lugar (cozinha, mercado) e do alarme. */
final class Avisos {

    static final String CANAL_COZINHA = "dumbfood_cozinha";
    static final String CANAL_ALARME = "dumbfood_alarme";
    static final String CANAL_MERCADO = "dumbfood_mercado";
    static final int ID_COZINHA = 7101;
    static final int ID_ALARME = 7102;
    static final int ID_MERCADO = 7103;

    private Avisos() {}

    static void criarCanais(Context ctx) {
        if (Build.VERSION.SDK_INT < 26) return;
        NotificationManager nm = ctx.getSystemService(NotificationManager.class);
        nm.createNotificationChannel(new NotificationChannel(CANAL_COZINHA, "Na cozinha", NotificationManager.IMPORTANCE_HIGH));
        nm.createNotificationChannel(new NotificationChannel(CANAL_MERCADO, "Passar no mercado", NotificationManager.IMPORTANCE_HIGH));
        // O som do alarme é tocado pelo AlarmeService (em loop); o canal fica mudo para não somar.
        NotificationChannel alarme = new NotificationChannel(CANAL_ALARME, "Alarme da cozinha", NotificationManager.IMPORTANCE_HIGH);
        alarme.setSound(null, null);
        alarme.enableVibration(false);
        nm.createNotificationChannel(alarme);
    }

    /** Abre o app num destino dumbfood://<destino> (o AtalhosPlugin repassa ao JS). */
    static PendingIntent abrir(Context ctx, String destino, int codigo) {
        Intent i = new Intent(Intent.ACTION_VIEW, Uri.parse("dumbfood://" + destino), ctx, MainActivity.class);
        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        return PendingIntent.getActivity(ctx, codigo, i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    @SuppressWarnings("deprecation")
    private static Notification.Builder builder(Context ctx, String canal) {
        criarCanais(ctx);
        Notification.Builder b = Build.VERSION.SDK_INT >= 26 ? new Notification.Builder(ctx, canal) : new Notification.Builder(ctx);
        b.setSmallIcon(android.R.drawable.ic_popup_reminder).setAutoCancel(true);
        if (Build.VERSION.SDK_INT < 26) {
            b.setPriority(Notification.PRIORITY_HIGH);
            b.setSound(RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION));
        }
        return b;
    }

    static void cozinha(Context ctx) {
        Notification n = builder(ctx, CANAL_COZINHA)
            .setContentTitle("Na cozinha?")
            .setContentText("Lance o que for comer agora no dumbfood.")
            .setContentIntent(abrir(ctx, "registrar", 1))
            .build();
        ctx.getSystemService(NotificationManager.class).notify(ID_COZINHA, n);
    }

    static void mercado(Context ctx, String corpo) {
        Notification n = builder(ctx, CANAL_MERCADO)
            .setContentTitle("Passe no mercado na volta")
            .setContentText(corpo)
            .setStyle(new Notification.BigTextStyle().bigText(corpo))
            .setContentIntent(abrir(ctx, "mercado", 2))
            .build();
        ctx.getSystemService(NotificationManager.class).notify(ID_MERCADO, n);
    }

    static AudioAttributes audioAlarme() {
        return new AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_ALARM).setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION).build();
    }
}
