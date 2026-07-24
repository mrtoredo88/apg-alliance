package ru.myapg.app;

import android.app.DownloadManager;
import android.content.Context;
import android.content.Intent;
import android.database.Cursor;
import android.net.Uri;
import android.os.Environment;
import android.os.Handler;
import android.os.Looper;
import android.provider.Settings;

import androidx.core.content.FileProvider;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;
import java.io.FileInputStream;
import java.security.MessageDigest;
import java.util.Locale;

@CapacitorPlugin(name = "NativeUpdater")
public class NativeUpdaterPlugin extends Plugin {
    private final Handler handler = new Handler(Looper.getMainLooper());
    private long activeDownloadId = -1;
    private PluginCall activeCall;
    private File activeFile;
    private String expectedSha256;

    @PluginMethod
    public void downloadAndInstall(PluginCall call) {
        String url = call.getString("url", "");
        String sha256 = call.getString("sha256", "").toLowerCase(Locale.ROOT);
        Integer versionCode = call.getInt("versionCode", 0);
        if (!url.startsWith("https://myapg.ru/") || !sha256.matches("[0-9a-f]{64}") || versionCode == null || versionCode <= 0) {
            call.reject("INVALID_UPDATE_METADATA", "INVALID_UPDATE_METADATA");
            return;
        }
        if (activeCall != null) {
            call.reject("UPDATE_ALREADY_IN_PROGRESS", "UPDATE_ALREADY_IN_PROGRESS");
            return;
        }

        File updatesDir = getContext().getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS);
        if (updatesDir == null) {
            call.reject("UPDATE_STORAGE_UNAVAILABLE", "UPDATE_STORAGE_UNAVAILABLE");
            return;
        }
        activeFile = new File(updatesDir, "apg-update-" + versionCode + ".apk");
        if (activeFile.exists() && !activeFile.delete()) {
            call.reject("UPDATE_FILE_UNAVAILABLE", "UPDATE_FILE_UNAVAILABLE");
            return;
        }

        DownloadManager.Request request = new DownloadManager.Request(Uri.parse(url))
            .setTitle("Обновление АПГ")
            .setDescription("Загрузка новой версии")
            .setMimeType("application/vnd.android.package-archive")
            .setAllowedOverMetered(true)
            .setAllowedOverRoaming(false)
            .setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE)
            .setDestinationUri(Uri.fromFile(activeFile));

        DownloadManager manager = (DownloadManager) getContext().getSystemService(Context.DOWNLOAD_SERVICE);
        activeCall = call;
        expectedSha256 = sha256;
        activeDownloadId = manager.enqueue(request);
        handler.post(this::pollDownload);
    }

    private void pollDownload() {
        if (activeCall == null || activeDownloadId < 0) return;
        DownloadManager manager = (DownloadManager) getContext().getSystemService(Context.DOWNLOAD_SERVICE);
        try (Cursor cursor = manager.query(new DownloadManager.Query().setFilterById(activeDownloadId))) {
            if (cursor == null || !cursor.moveToFirst()) {
                fail("UPDATE_DOWNLOAD_NOT_FOUND");
                return;
            }
            int status = cursor.getInt(cursor.getColumnIndexOrThrow(DownloadManager.COLUMN_STATUS));
            long downloaded = cursor.getLong(cursor.getColumnIndexOrThrow(DownloadManager.COLUMN_BYTES_DOWNLOADED_SO_FAR));
            long total = cursor.getLong(cursor.getColumnIndexOrThrow(DownloadManager.COLUMN_TOTAL_SIZE_BYTES));
            JSObject progress = new JSObject();
            progress.put("downloadedBytes", downloaded);
            progress.put("totalBytes", total);
            progress.put("percent", total > 0 ? Math.min(100, Math.round(downloaded * 100f / total)) : 0);
            notifyListeners("downloadProgress", progress);

            if (status == DownloadManager.STATUS_SUCCESSFUL) {
                verifyAndInstall();
            } else if (status == DownloadManager.STATUS_FAILED) {
                fail("UPDATE_DOWNLOAD_FAILED");
            } else {
                handler.postDelayed(this::pollDownload, 500);
            }
        } catch (Exception error) {
            fail("UPDATE_DOWNLOAD_FAILED");
        }
    }

    private void verifyAndInstall() {
        new Thread(() -> {
            try {
                String actualSha256 = sha256(activeFile);
                if (!expectedSha256.equals(actualSha256)) {
                    if (activeFile.exists()) activeFile.delete();
                    handler.post(() -> fail("UPDATE_CHECKSUM_MISMATCH"));
                    return;
                }
                handler.post(this::openInstaller);
            } catch (Exception error) {
                handler.post(() -> fail("UPDATE_VERIFICATION_FAILED"));
            }
        }).start();
    }

    private void openInstaller() {
        if (!getContext().getPackageManager().canRequestPackageInstalls()) {
            Intent settingsIntent = new Intent(
                Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
                Uri.parse("package:" + getContext().getPackageName())
            );
            getActivity().startActivity(settingsIntent);
            JSObject result = new JSObject();
            result.put("needsInstallPermission", true);
            resolve(result);
            return;
        }

        Uri apkUri = FileProvider.getUriForFile(
            getContext(),
            getContext().getPackageName() + ".fileprovider",
            activeFile
        );
        Intent installIntent = new Intent(Intent.ACTION_VIEW)
            .setDataAndType(apkUri, "application/vnd.android.package-archive")
            .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
        getActivity().startActivity(installIntent);
        JSObject result = new JSObject();
        result.put("installerOpened", true);
        resolve(result);
    }

    private String sha256(File file) throws Exception {
        MessageDigest digest = MessageDigest.getInstance("SHA-256");
        try (FileInputStream stream = new FileInputStream(file)) {
            byte[] buffer = new byte[64 * 1024];
            int count;
            while ((count = stream.read(buffer)) > 0) digest.update(buffer, 0, count);
        }
        StringBuilder result = new StringBuilder();
        for (byte value : digest.digest()) result.append(String.format(Locale.ROOT, "%02x", value));
        return result.toString();
    }

    private void fail(String code) {
        PluginCall call = activeCall;
        clear();
        if (call != null) call.reject(code, code);
    }

    private void resolve(JSObject result) {
        PluginCall call = activeCall;
        clear();
        if (call != null) call.resolve(result);
    }

    private void clear() {
        handler.removeCallbacksAndMessages(null);
        activeCall = null;
        activeDownloadId = -1;
        activeFile = null;
        expectedSha256 = null;
    }

    @Override
    protected void handleOnDestroy() {
        clear();
        super.handleOnDestroy();
    }
}
