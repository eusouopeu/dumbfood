package br.com.dumbfood.app;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.net.Uri;
import android.widget.RemoteViews;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;

/**
 * Widget "o dia": kcal consumidas contra a meta, com barra de progresso. Tocar abre o app
 * direto no registro de refeição. Os números vêm do app (AtalhosPlugin.atualizarWidget);
 * quando o dia gravado não é hoje, o widget mostra zero em vez do total de ontem.
 */
public class DiaWidgetProvider extends AppWidgetProvider {

    @Override
    public void onUpdate(Context context, AppWidgetManager manager, int[] ids) {
        desenhar(context, manager, ids);
    }

    static void desenhar(Context context, AppWidgetManager manager, int[] ids) {
        SharedPreferences prefs = context.getSharedPreferences(AtalhosPlugin.PREFS, Context.MODE_PRIVATE);
        String hoje = new SimpleDateFormat("yyyy-MM-dd", Locale.US).format(new Date());
        int kcal = hoje.equals(prefs.getString("dia", "")) ? prefs.getInt("kcal", 0) : 0;
        int meta = Math.max(1, prefs.getInt("meta", 2000));
        Locale br = new Locale("pt", "BR");
        int restam = meta - kcal;

        Intent abrir = new Intent(Intent.ACTION_VIEW, Uri.parse("dumbfood://registrar"), context, MainActivity.class);
        PendingIntent toque = PendingIntent.getActivity(
            context, 0, abrir, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

        for (int id : ids) {
            RemoteViews v = new RemoteViews(context.getPackageName(), R.layout.widget_dia);
            v.setTextViewText(R.id.widget_kcal, String.format(br, "%,d / %,d kcal", kcal, meta));
            v.setTextViewText(R.id.widget_resto, restam >= 0
                ? String.format(br, "restam %,d", restam)
                : String.format(br, "%,d acima da meta", -restam));
            v.setProgressBar(R.id.widget_barra, meta, Math.min(kcal, meta), false);
            v.setOnClickPendingIntent(R.id.widget_raiz, toque);
            manager.updateAppWidget(id, v);
        }
    }
}
