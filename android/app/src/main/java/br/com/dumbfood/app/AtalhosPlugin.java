package br.com.dumbfood.app;

import android.appwidget.AppWidgetManager;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.net.Uri;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Ponte dos atalhos do ícone (res/xml/shortcuts.xml) e do widget do dia (DiaWidgetProvider).
 *
 * - Atalhos e widget abrem a MainActivity com uma URI "dumbfood://<destino>"; aqui ela vira o
 *   evento "abrir" para o JS navegar. Cobre abertura a frio e app já aberto, como o
 *   ShareReceiverPlugin.
 * - O JS chama atualizarWidget com as kcal de hoje e a meta; os números ficam em
 *   SharedPreferences, de onde o widget lê, e o widget é redesenhado na hora.
 */
@CapacitorPlugin(name = "Atalhos")
public class AtalhosPlugin extends Plugin {

    static final String PREFS = "dumbfood_widget";

    @Override
    protected void handleOnNewIntent(Intent intent) {
        super.handleOnNewIntent(intent);
        if (intent == null || !Intent.ACTION_VIEW.equals(intent.getAction())) return;
        Uri uri = intent.getData();
        if (uri == null || !"dumbfood".equals(uri.getScheme())) return;
        JSObject data = new JSObject();
        data.put("destino", uri.getHost());
        notifyListeners("abrir", data, true);
    }

    @PluginMethod
    public void atualizarWidget(PluginCall call) {
        Context ctx = getContext();
        SharedPreferences.Editor prefs = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit();
        prefs.putInt("kcal", call.getInt("kcal", 0));
        prefs.putInt("meta", call.getInt("meta", 2000));
        prefs.putString("dia", call.getString("dia", ""));
        prefs.apply();

        AppWidgetManager manager = AppWidgetManager.getInstance(ctx);
        int[] ids = manager.getAppWidgetIds(new ComponentName(ctx, DiaWidgetProvider.class));
        if (ids.length > 0) DiaWidgetProvider.desenhar(ctx, manager, ids);
        call.resolve();
    }
}
