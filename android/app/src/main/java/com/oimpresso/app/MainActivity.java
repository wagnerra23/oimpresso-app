package com.oimpresso.app;

import android.os.Bundle;
import android.webkit.WebView;
import androidx.activity.OnBackPressedCallback;
import com.getcapacitor.BridgeActivity;

/**
 * Botão voltar do Android.
 *
 * As telas vivem no ERP (https://oimpresso.com/m, Inertia). Cada navegação do Inertia é um
 * history.pushState, e o voltar da WebView dispara o popstate que o Inertia trata — medido no
 * emulador (Android 16): com toque real, voltar foi de /login?passo=2 a ?passo=1 e à raiz.
 *
 * O tratamento padrão do @capacitor/app faz o mesmo, mas na tela inicial não faz nada (o app fica
 * parado). Aqui, na raiz, o app vai para segundo plano, como qualquer app Android. O padrão do
 * plugin está desligado em capacitor.config.json (plugins.App.disableBackButtonHandler).
 * Consequência: o evento 'backButton' do plugin App NÃO chega à página. Se o ERP precisar dele
 * (ex.: fechar um modal no voltar), troque este callback por um repasse ao JS.
 */
public class MainActivity extends BridgeActivity {

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                WebView webView = getBridge() != null ? getBridge().getWebView() : null;
                if (webView != null && webView.canGoBack()) {
                    webView.goBack();
                } else {
                    moveTaskToBack(true);
                }
            }
        });
    }
}
