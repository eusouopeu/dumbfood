package br.com.dumbfood.app;

import android.content.Intent;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Recebe o texto/link compartilhado de outros apps via a folha de compartilhamento do Android
 * (intent-filter ACTION_SEND declarado no AndroidManifest para a MainActivity) e repassa para o
 * JS através do evento "shareReceived". `handleOnNewIntent` cobre tanto abertura a frio (o
 * BridgeActivity chama onNewIntent com a intent inicial assim que os plugins estão prontos)
 * quanto o app já aberto recebendo um novo compartilhamento.
 */
@CapacitorPlugin(name = "ShareReceiver")
public class ShareReceiverPlugin extends Plugin {

    @Override
    protected void handleOnNewIntent(Intent intent) {
        super.handleOnNewIntent(intent);
        emitIfShare(intent);
    }

    private void emitIfShare(Intent intent) {
        if (intent == null || !Intent.ACTION_SEND.equals(intent.getAction())) return;
        if (!"text/plain".equals(intent.getType())) return;

        String texto = intent.getStringExtra(Intent.EXTRA_TEXT);
        if (texto == null || texto.trim().isEmpty()) return;

        JSObject data = new JSObject();
        data.put("text", texto.trim());
        // retainUntilConsumed: garante que a abertura a frio não perca o evento caso o
        // listener do JS ainda não tenha sido registrado no instante em que ele dispara.
        notifyListeners("shareReceived", data, true);
    }
}
