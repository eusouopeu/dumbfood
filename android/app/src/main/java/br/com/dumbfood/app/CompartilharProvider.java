package br.com.dumbfood.app;

import android.content.ContentProvider;
import android.content.ContentValues;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.content.pm.Signature;
import android.database.Cursor;
import android.database.MatrixCursor;
import android.net.Uri;
import android.os.Build;
import java.io.File;
import java.nio.charset.StandardCharsets;
import java.io.ByteArrayOutputStream;
import java.io.FileInputStream;
import java.io.InputStream;
import java.security.MessageDigest;

/**
 * Entrega as refeições ao Nexo (com.pedro.nexo), sem internet:
 * content://br.com.dumbfood.app.compartilhar/alimentacao → uma linha, coluna "json".
 * Só responde ao Nexo assinado pela chave do Pedro (SHA-256 do certificado); qualquer outro
 * app recebe SecurityException. Sem envio ligado, nenhuma linha.
 */
public class CompartilharProvider extends ContentProvider {

    private static final String NEXO = "com.pedro.nexo";
    // android/debug.keystore do Nexo = ~/.android/debug.keystore do Mac
    private static final String CHAVE_NEXO = "548f928701c669268c92ff63a41802b412b95136cdcff45607e1fc00f6470795";

    @Override
    public boolean onCreate() {
        return true;
    }

    @Override
    public Cursor query(Uri uri, String[] projection, String selection, String[] selectionArgs, String sortOrder) {
        if (!"/alimentacao".equals(uri.getPath())) return null;
        if (!NEXO.equals(getCallingPackage()) || !assinadoPeloPedro(NEXO)) throw new SecurityException("dumbfood: app não autorizado");
        MatrixCursor c = new MatrixCursor(new String[] { "json" });
        File f = CompartilharPlugin.arquivoNexo(getContext());
        if (!f.exists()) return c;
        try {
            c.addRow(new Object[] { ler(f) });
        } catch (Exception e) {
            // arquivo sendo trocado: responde vazio, o Nexo tenta de novo na próxima abertura
        }
        return c;
    }

    private static String ler(File f) throws Exception {
        try (InputStream i = new FileInputStream(f); ByteArrayOutputStream o = new ByteArrayOutputStream()) {
            byte[] b = new byte[16 * 1024];
            int n;
            while ((n = i.read(b)) > 0) o.write(b, 0, n);
            return new String(o.toByteArray(), StandardCharsets.UTF_8);
        }
    }

    @SuppressWarnings("deprecation")
    private boolean assinadoPeloPedro(String pacote) {
        PackageManager pm = getContext().getPackageManager();
        byte[] esperado = new byte[CHAVE_NEXO.length() / 2];
        for (int i = 0; i < esperado.length; i++) esperado[i] = (byte) Integer.parseInt(CHAVE_NEXO.substring(2 * i, 2 * i + 2), 16);
        try {
            if (Build.VERSION.SDK_INT >= 28) return pm.hasSigningCertificate(pacote, esperado, PackageManager.CERT_INPUT_SHA256);
            PackageInfo pi = pm.getPackageInfo(pacote, PackageManager.GET_SIGNATURES);
            for (Signature s : pi.signatures) if (MessageDigest.isEqual(MessageDigest.getInstance("SHA-256").digest(s.toByteArray()), esperado)) return true;
        } catch (Exception e) {
            return false;
        }
        return false;
    }

    @Override
    public String getType(Uri uri) {
        return null;
    }

    @Override
    public Uri insert(Uri uri, ContentValues values) {
        throw new UnsupportedOperationException();
    }

    @Override
    public int delete(Uri uri, String selection, String[] selectionArgs) {
        throw new UnsupportedOperationException();
    }

    @Override
    public int update(Uri uri, ContentValues values, String selection, String[] selectionArgs) {
        throw new UnsupportedOperationException();
    }
}
