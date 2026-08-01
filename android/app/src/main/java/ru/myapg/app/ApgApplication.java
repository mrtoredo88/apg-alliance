package ru.myapg.app;

import android.app.Application;
import ru.rustore.sdk.pushclient.RuStorePushClient;

public class ApgApplication extends Application {
    @Override public void onCreate() {
        super.onCreate();
        if (!BuildConfig.RUSTORE_PUSH_PROJECT_ID.isEmpty()) RuStorePushClient.INSTANCE.init(this, BuildConfig.RUSTORE_PUSH_PROJECT_ID);
        NotificationChannels.create(this);
    }
}
