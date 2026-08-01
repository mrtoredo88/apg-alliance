package ru.myapg.app;

import android.Manifest;
import android.content.Context;
import android.os.Build;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import ru.rustore.sdk.pushclient.RuStorePushClient;

@CapacitorPlugin(name = "RuStorePush", permissions = { @Permission(alias = "notifications", strings = { Manifest.permission.POST_NOTIFICATIONS }) })
public class RuStorePushPlugin extends Plugin {
    @PluginMethod public void checkPermissions(PluginCall call) {
        JSObject result = new JSObject();
        result.put("receive", Build.VERSION.SDK_INT < 33 || getPermissionState("notifications") == PermissionState.GRANTED ? "granted" : "prompt");
        call.resolve(result);
    }

    @PluginMethod public void requestPermissions(PluginCall call) {
        if (Build.VERSION.SDK_INT < 33) { checkPermissions(call); return; }
        requestPermissionForAlias("notifications", call, "permissionResult");
    }

    @PermissionCallback private void permissionResult(PluginCall call) { checkPermissions(call); }

    @PluginMethod public void getToken(PluginCall call) {
        if (BuildConfig.RUSTORE_PUSH_PROJECT_ID.isEmpty()) { call.reject("RuStore Push project is not configured", "RUSTORE_NOT_CONFIGURED"); return; }
        RuStorePushClient.INSTANCE.getToken().addOnSuccessListener(token -> {
            getContext().getSharedPreferences(ApgRuStoreMessagingService.PREFS, Context.MODE_PRIVATE).edit().putString(ApgRuStoreMessagingService.TOKEN, token).apply();
            JSObject result = new JSObject(); result.put("value", token); call.resolve(result);
        }).addOnFailureListener(error -> call.reject("RuStore token unavailable", "RUSTORE_TOKEN_UNAVAILABLE", new Exception(error)));
    }

    @PluginMethod public void getPendingToken(PluginCall call) {
        String token = getContext().getSharedPreferences(ApgRuStoreMessagingService.PREFS, Context.MODE_PRIVATE).getString(ApgRuStoreMessagingService.TOKEN, "");
        JSObject result = new JSObject(); result.put("value", token); call.resolve(result);
    }

    @PluginMethod public void clearPendingToken(PluginCall call) {
        getContext().getSharedPreferences(ApgRuStoreMessagingService.PREFS, Context.MODE_PRIVATE).edit().remove(ApgRuStoreMessagingService.TOKEN).apply();
        call.resolve();
    }

    @PluginMethod public void deleteToken(PluginCall call) {
        if (BuildConfig.RUSTORE_PUSH_PROJECT_ID.isEmpty()) { call.resolve(); return; }
        RuStorePushClient.INSTANCE.deleteToken().addOnSuccessListener(value -> clearPendingToken(call)).addOnFailureListener(error -> call.reject("RuStore token deletion failed", "RUSTORE_TOKEN_DELETE_FAILED", new Exception(error)));
    }
}
