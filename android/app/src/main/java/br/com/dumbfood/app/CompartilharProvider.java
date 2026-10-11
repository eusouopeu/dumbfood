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
 * Entrega pacotes aos outros apps do Pedro, sem internet (uma linha, coluna "json"):
 * - content://br.com.dumbfood.app.compartilhar/alimentacao → refeições, só para o Nexo;
 * - content://br.com.dumbfood.app.compartilhar/brita → dia e cardápio, só para o Brita.
 * Cada caminho confere pacote e assinatura (SHA-256 do certificado) de quem pede; qualquer
 * outro app recebe SecurityException. Com o envio desligado, nenhuma linha.
 */
public class CompartilharProvider extends ContentProvider {

    private static final String NEXO = "com.pedro.nexo";
    private static final String BRITA = "com.pedro.rotinas";
    // android/debug.keystore do Nexo e do dumbfood = ~/.android/debug.keystore do Mac
    static final String CHAVE_DEBUG = "548f928701c669268c92ff63a41802b412b95136cdcff45607e1fc00f6470795";
    // android/brita.keystore do Brita (rotinas)
    static final String CHAVE_BRITA = "5dbd6119e71515d7e68d7f369d485524926fddf2208e47e02a214a9ee415c89c";

    @Override
    public boolean onCreate() {
        return true;
    }

    @Override
    public Cursor query(Uri uri, String[] projection, String selection, String[] selectionArgs, String sortOrder) {
        String caminho = uri.getPath();
        String pacote;
        String chave;
        File f;
        if ("/alimentacao".equals(caminho)) {
            pacote = NEXO;
            chave = CHAVE_DEBUG;
            f = CompartilharPlugin.arquivoNexo(getContext());
        } else if ("/brita".equals(caminho)) {
            pacote = BRITA;
            chave = CHAVE_BRITA;
            f = CompartilharPlugin.arquivoBrita(getContext());
        } else {
            return null;
        }
        if (!pacote.equals(getCallingPackage()) || !assinado(getContext(), pacote, chave)) throw new SecurityException("dumbfood: app não autorizado");
        MatrixCursor c = new MatrixCursor(new String[] { "json" });
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
    static boolean assinado(android.content.Context ctx, String pacote, String sha256) {
        PackageManager pm = ctx.getPackageManager();
        byte[] esperado = new byte[sha256.length() / 2];
        for (int i = 0; i < esperado.length; i++) esperado[i] = (byte) Integer.parseInt(sha256.substring(2 * i, 2 * i + 2), 16);
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
