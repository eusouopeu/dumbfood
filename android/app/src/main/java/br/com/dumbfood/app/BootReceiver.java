package br.com.dumbfood.app;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/** Cercas de GPS não sobrevivem ao reboot nem à atualização do app: registra de novo. */
public class BootReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context ctx, Intent intent) {
        String a = intent.getAction();
        if (Intent.ACTION_BOOT_COMPLETED.equals(a) || Intent.ACTION_MY_PACKAGE_REPLACED.equals(a)) Lugares.registrar(ctx);
    }
}
