package br.com.dumbfood.app;

import android.content.Intent;
import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Precisa ser registrado antes do super.onCreate(): é ele quem monta o Bridge e
        // dispara a intent inicial (compartilhamento a frio) para os plugins já carregados.
        registerPlugin(ShareReceiverPlugin.class);
        registerPlugin(AtalhosPlugin.class);
        registerPlugin(CompartilharPlugin.class);
        registerPlugin(LugaresPlugin.class);
        super.onCreate(savedInstanceState);
        desligarAlarme(getIntent());
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        desligarAlarme(intent);
    }

    /** Abrir o registro (pela notificação do alarme ou de qualquer jeito) desliga o alarme da cozinha. */
    private void desligarAlarme(Intent intent) {
        if (intent == null || intent.getData() == null || !"registrar".equals(intent.getData().getHost())) return;
        if (Lugares.prefs(this).getBoolean("alarmeTocando", false)) stopService(new Intent(this, AlarmeService.class));
    }
}
