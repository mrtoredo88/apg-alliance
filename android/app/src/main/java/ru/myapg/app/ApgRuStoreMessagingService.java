package ru.myapg.app;

import android.content.Context;
import java.util.List;
import ru.rustore.sdk.pushclient.messaging.exception.RuStorePushClientException;
import ru.rustore.sdk.pushclient.messaging.model.RemoteMessage;
import ru.rustore.sdk.pushclient.messaging.service.RuStoreMessagingService;

public class ApgRuStoreMessagingService extends RuStoreMessagingService {
    static final String PREFS = "apg_rustore_push";
    static final String TOKEN = "pending_token";

    @Override public void onNewToken(String token) {
        getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putString(TOKEN, token).apply();
    }
    @Override public void onMessageReceived(RemoteMessage message) { }
    @Override public void onDeletedMessages() { }
    @Override public void onError(List<? extends RuStorePushClientException> errors) { }
}
