package br.com.dumbfood.app;

import android.content.Context;
import android.content.pm.PackageManager;
import android.content.pm.ProviderInfo;
import android.database.Cursor;
import android.net.Uri;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.File;
import java.io.FileOutputStream;
import java.nio.charset.StandardCharsets;

/**
 * Troca com os outros apps do Pedro no mesmo celular, sem internet:
 * - publicarNexo / publicarBrita: guardam na área privada os pacotes (src/lib/compartilharNexo.ts
 *   e compartilharBrita.ts) que o CompartilharProvider entrega só ao app certo; json nulo apaga.
 * - lerNexo: lê do provider do Nexo o que evitar (alergias, teste de eliminação), conferindo
 *   antes que o Nexo instalado é o do Pedro.
 */
@CapacitorPlugin(name = "Compartilhar")
public class CompartilharPlugin extends Plugin {

    static final String NEXO = "com.pedro.nexo";
    private static final String AUTORIDADE_NEXO = "com.pedro.nexo.compartilhar";

    static File arquivoNexo(Context ctx) {
        return new File(ctx.getFilesDir(), "compartilhar/nexo.json");
    }

    static File arquivoBrita(Context ctx) {
        return new File(ctx.getFilesDir(), "compartilhar/brita.json");
    }

    private static void gravar(File f, String json) throws Exception {
        if (json == null) {
            f.delete();
            return;
        }
        File pasta = f.getParentFile();
        if (pasta != null) pasta.mkdirs();
        File tmp = new File(f.getPath() + ".tmp");
        try (FileOutputStream o = new FileOutputStream(tmp)) {
            o.write(json.getBytes(StandardCharsets.UTF_8));
        }
        if (!tmp.renameTo(f)) throw new Exception("não deu para gravar");
    }

    @PluginMethod
    public void publicarNexo(PluginCall call) {
        try {
            gravar(arquivoNexo(getContext()), call.getString("json"));
            call.resolve();
        } catch (Exception e) {
            call.reject(e.getMessage());
        }
    }

    @PluginMethod
    public void publicarBrita(PluginCall call) {
        try {
            gravar(arquivoBrita(getContext()), call.getString("json"));
            call.resolve();
        } catch (Exception e) {
            call.reject(e.getMessage());
        }
    }

    @PluginMethod
    public void lerNexo(PluginCall call) {
        Context ctx = getContext();
        JSObject r = new JSObject();
        PackageManager pm = ctx.getPackageManager();
        try {
            pm.getPackageInfo(NEXO, 0);
        } catch (PackageManager.NameNotFoundException e) {
            call.resolve(erro(r, "nao-instalado"));
            return;
        }
        if (!CompartilharProvider.assinado(ctx, NEXO, CompartilharProvider.CHAVE_DEBUG)) {
            call.resolve(erro(r, "assinatura"));
            return;
        }
        ProviderInfo pi = pm.resolveContentProvider(AUTORIDADE_NEXO, 0);
        if (pi == null || !NEXO.equals(pi.packageName)) {
            call.resolve(erro(r, "desligado")); // Nexo antigo, sem o provider
            return;
        }
        try (Cursor c = ctx.getContentResolver().query(Uri.parse("content://" + AUTORIDADE_NEXO + "/dumbfood"), null, null, null, null)) {
            if (c == null || !c.moveToFirst()) erro(r, "desligado");
            else r.put("json", c.getString(0));
            call.resolve(r);
        } catch (SecurityException e) {
            call.resolve(erro(r, "recusado"));
        } catch (Exception e) {
            call.reject(e.getMessage());
        }
    }

    private static JSObject erro(JSObject r, String codigo) {
        r.put("erro", codigo);
        return r;
    }
}
