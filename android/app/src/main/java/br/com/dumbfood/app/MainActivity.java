package br.com.dumbfood.app;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Precisa ser registrado antes do super.onCreate(): é ele quem monta o Bridge e
        // dispara a intent inicial (compartilhamento a frio) para os plugins já carregados.
        registerPlugin(ShareReceiverPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
