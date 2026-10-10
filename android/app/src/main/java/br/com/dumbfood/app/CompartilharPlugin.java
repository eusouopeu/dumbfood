package br.com.dumbfood.app;

import android.content.Context;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.File;
import java.io.FileOutputStream;
import java.nio.charset.StandardCharsets;

/**
 * Guarda o pacote de refeições para o Nexo (src/lib/compartilharNexo.ts) na área privada do
 * app; o CompartilharProvider o entrega só ao Nexo. json nulo apaga (envio desligado).
 */
@CapacitorPlugin(name = "Compartilhar")
public class CompartilharPlugin extends Plugin {

    static File arquivoNexo(Context ctx) {
        return new File(ctx.getFilesDir(), "compartilhar/nexo.json");
    }

    @PluginMethod
    public void publicarNexo(PluginCall call) {
        File f = arquivoNexo(getContext());
        String json = call.getString("json");
        try {
            if (json == null) {
                f.delete();
            } else {
                File pasta = f.getParentFile();
                if (pasta != null) pasta.mkdirs();
                File tmp = new File(f.getPath() + ".tmp");
                try (FileOutputStream o = new FileOutputStream(tmp)) {
                    o.write(json.getBytes(StandardCharsets.UTF_8));
                }
                if (!tmp.renameTo(f)) throw new Exception("não deu para gravar");
            }
            call.resolve();
        } catch (Exception e) {
            call.reject(e.getMessage());
        }
    }
}
