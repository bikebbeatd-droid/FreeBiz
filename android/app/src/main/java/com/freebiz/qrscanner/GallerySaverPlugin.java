package com.freebiz.qrscanner;

import android.content.ContentResolver;
import android.content.ContentValues;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.MediaStore;
import android.util.Base64;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.OutputStream;

@CapacitorPlugin(name = "GallerySaver")
public class GallerySaverPlugin extends Plugin {
    @PluginMethod
    public void savePng(PluginCall call) {
        String encoded = call.getString("data");
        String filename = call.getString("filename", "freebiz-qr.png");
        if (encoded == null || encoded.isEmpty()) {
            call.reject("Missing PNG image data.");
            return;
        }

        Uri imageUri = null;
        ContentResolver resolver = getContext().getContentResolver();
        try {
            byte[] imageBytes = Base64.decode(encoded, Base64.DEFAULT);
            ContentValues values = new ContentValues();
            values.put(MediaStore.Images.Media.DISPLAY_NAME, filename);
            values.put(MediaStore.Images.Media.MIME_TYPE, "image/png");
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                values.put(MediaStore.Images.Media.RELATIVE_PATH,
                    Environment.DIRECTORY_PICTURES + "/FreeBiz");
                values.put(MediaStore.Images.Media.IS_PENDING, 1);
            }

            imageUri = resolver.insert(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, values);
            if (imageUri == null) {
                throw new IllegalStateException("Android could not create a Gallery image.");
            }

            try (OutputStream output = resolver.openOutputStream(imageUri)) {
                if (output == null) {
                    throw new IllegalStateException("Android could not open the saved image.");
                }
                output.write(imageBytes);
                output.flush();
            }

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                ContentValues ready = new ContentValues();
                ready.put(MediaStore.Images.Media.IS_PENDING, 0);
                resolver.update(imageUri, ready, null, null);
            }

            JSObject result = new JSObject();
            result.put("uri", imageUri.toString());
            call.resolve(result);
        } catch (Exception error) {
            if (imageUri != null) {
                try { resolver.delete(imageUri, null, null); } catch (Exception ignored) {}
            }
            call.reject("Could not save QR code to Gallery: " + error.getMessage());
        }
    }
}
