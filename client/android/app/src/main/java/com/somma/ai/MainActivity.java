package com.somma.ai;

import android.app.KeyguardManager;
import android.content.Context;
import android.content.DialogInterface;
import android.hardware.biometrics.BiometricPrompt;
import android.os.Build;
import android.os.Bundle;
import android.os.CancellationSignal;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        if (getBridge() != null && getBridge().getWebView() != null) {
            WebView webView = getBridge().getWebView();
            webView.addJavascriptInterface(new SommaNativeBiometric(webView), "SommaNativeBiometric");
        }
    }

    public class SommaNativeBiometric {
        private final WebView webView;

        public SommaNativeBiometric(WebView webView) {
            this.webView = webView;
        }

        @JavascriptInterface
        public boolean isAvailable() {
            if (Build.VERSION.SDK_INT < Build.VERSION_CODES.P) {
                return false;
            }
            KeyguardManager km = (KeyguardManager) getSystemService(Context.KEYGUARD_SERVICE);
            return km != null && km.isKeyguardSecure();
        }

        @JavascriptInterface
        public void authenticate(final String title, final String subtitle) {
            runOnUiThread(() -> {
                if (Build.VERSION.SDK_INT < Build.VERSION_CODES.P) {
                    sendResultToJs(false, "Versão do Android incompatível com BiometricPrompt.");
                    return;
                }

                try {
                    CancellationSignal cancellationSignal = new CancellationSignal();
                    BiometricPrompt prompt = new BiometricPrompt.Builder(MainActivity.this)
                        .setTitle(title != null ? title : "Desbloquear Somma AI")
                        .setSubtitle(subtitle != null ? subtitle : "Confirme sua digital para continuar")
                        .setNegativeButton(
                            "Usar senha",
                            getMainExecutor(),
                            (DialogInterface dialog, int which) -> sendResultToJs(false, "Cancelado pelo usuário")
                        )
                        .build();

                    prompt.authenticate(
                        cancellationSignal,
                        getMainExecutor(),
                        new BiometricPrompt.AuthenticationCallback() {
                            @Override
                            public void onAuthenticationSucceeded(BiometricPrompt.AuthenticationResult result) {
                                super.onAuthenticationSucceeded(result);
                                sendResultToJs(true, null);
                            }

                            @Override
                            public void onAuthenticationError(int errorCode, CharSequence errString) {
                                super.onAuthenticationError(errorCode, errString);
                                sendResultToJs(false, errString != null ? errString.toString() : "Leitura cancelada");
                            }
                        }
                    );
                } catch (Exception e) {
                    sendResultToJs(false, e.getMessage());
                }
            });
        }

        private void sendResultToJs(final boolean success, final String errorMessage) {
            runOnUiThread(() -> {
                String safeErr = errorMessage == null
                    ? "null"
                    : "'" + errorMessage.replace("\\", "\\\\").replace("'", "\\'").replace("\n", " ") + "'";
                String js = "window.__onSommaBiometricResult && window.__onSommaBiometricResult("
                    + (success ? "true" : "false") + ", " + safeErr + ");";
                webView.evaluateJavascript(js, null);
            });
        }
    }
}
