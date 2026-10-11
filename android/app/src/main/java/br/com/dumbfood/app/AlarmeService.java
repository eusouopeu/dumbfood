package br.com.dumbfood.app;

import android.app.Notification;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.media.MediaPlayer;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;
import android.os.IBinder;
import android.os.VibrationEffect;
import android.os.Vibrator;

/**
 * Alarme da cozinha: toca o som de alarme em loop (e vibra) até o Pedro tocar em "Desligar"
 * ou em "Registrar" — este também desliga e já abre o registro da refeição da hora.
 * Roda como serviço em primeiro plano, que é o que o Android deixa iniciar a partir de um
 * evento de cerca com o app fechado.
 */
public class AlarmeService extends Service {

    static final String PARAR = "br.com.dumbfood.app.PARAR_ALARME";

    private MediaPlayer player;
    private Vibrator vibrador;

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    private PendingIntent acao(String acao, int codigo) {
        Intent i = new Intent(this, AlarmeService.class).setAction(acao);
        return PendingIntent.getService(this, codigo, i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        String a = intent != null ? intent.getAction() : null;
        if (PARAR.equals(a)) {
            parar();
            return START_NOT_STICKY;
        }
        Avisos.criarCanais(this);
        Lugares.prefs(this).edit().putBoolean("alarmeTocando", true).apply();
        @SuppressWarnings("deprecation")
        Notification.Builder b = Build.VERSION.SDK_INT >= 26 ? new Notification.Builder(this, Avisos.CANAL_ALARME) : new Notification.Builder(this);
        b.setSmallIcon(android.R.drawable.ic_lock_idle_alarm)
            .setContentTitle("Na cozinha: registre o que vai comer")
            .setContentText("O alarme só para quando você desligar.")
            .setOngoing(true)
            .setCategory(Notification.CATEGORY_ALARM)
            // "Registrar" abre o app direto (Android 12+ não deixa um serviço abrir tela a
            // partir do toque na notificação); a MainActivity desliga o alarme ao abrir.
            .setContentIntent(Avisos.abrir(this, "registrar", 11))
            .setDeleteIntent(acao(PARAR, 12))
            .addAction(new Notification.Action.Builder(null, "Registrar", Avisos.abrir(this, "registrar", 13)).build())
            .addAction(new Notification.Action.Builder(null, "Desligar", acao(PARAR, 14)).build());
        Notification n = b.build();
        if (Build.VERSION.SDK_INT >= 29) startForeground(Avisos.ID_ALARME, n, ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK);
        else startForeground(Avisos.ID_ALARME, n);
        tocar();
        return START_NOT_STICKY;
    }

    private void tocar() {
        if (player != null) return;
        Uri som = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM);
        if (som == null) som = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE);
        try {
            player = new MediaPlayer();
            player.setAudioAttributes(Avisos.audioAlarme());
            player.setDataSource(this, som);
            player.setLooping(true);
            player.prepare();
            player.start();
        } catch (Exception e) {
            player = null; // sem som (aparelho sem toque de alarme): fica a vibração
        }
        vibrador = (Vibrator) getSystemService(Context.VIBRATOR_SERVICE);
        if (vibrador != null && vibrador.hasVibrator()) {
            long[] padrao = { 0, 800, 600 };
            if (Build.VERSION.SDK_INT >= 26) vibrador.vibrate(VibrationEffect.createWaveform(padrao, 0), Avisos.audioAlarme());
            else vibrador.vibrate(padrao, 0);
        }
    }

    private void parar() {
        if (player != null) {
            try {
                player.stop();
            } catch (Exception e) {
                // já parado
            }
            player.release();
            player = null;
        }
        if (vibrador != null) vibrador.cancel();
        if (Build.VERSION.SDK_INT >= 24) stopForeground(STOP_FOREGROUND_REMOVE);
        else stopForeground(true);
        getSystemService(NotificationManager.class).cancel(Avisos.ID_ALARME);
        Lugares.prefs(this).edit().putBoolean("alarmeTocando", false).apply();
        stopSelf();
    }

    @Override
    public void onDestroy() {
        if (player != null) player.release();
        player = null;
        if (vibrador != null) vibrador.cancel();
        Lugares.prefs(this).edit().putBoolean("alarmeTocando", false).apply();
        super.onDestroy();
    }
}
