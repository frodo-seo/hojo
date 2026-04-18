package com.hojo.app

import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.provider.Settings
import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification
import android.text.TextUtils

class HojoNotificationListener : NotificationListenerService() {
    override fun onNotificationPosted(sbn: StatusBarNotification?) {
        if (sbn == null) return
        val pkg = sbn.packageName ?: return
        if (pkg !in WATCHED_PACKAGES) return

        val extras = sbn.notification?.extras ?: return
        val title = extras.getCharSequence("android.title")?.toString() ?: ""
        val text = extras.getCharSequence("android.text")?.toString() ?: ""
        val bigText = extras.getCharSequence("android.bigText")?.toString() ?: ""
        val body = if (bigText.isNotBlank()) bigText else text

        if (title.isBlank() && body.isBlank()) return

        HojoNotificationPlugin.emitNotification(
            pkg = pkg,
            title = title,
            body = body,
            postedAt = sbn.postTime,
            key = sbn.key ?: ""
        )
    }

    companion object {
        val WATCHED_PACKAGES = setOf(
            "com.nhn.android.search",        // 네이버(페이 알림 포함 가능)
            "com.naver.nownpay",             // 네이버페이 (추정)
            "com.hyundaicard.appcard",       // 현대카드
            "com.kakaopay.app",              // 카카오페이 (실기기 확인 필요)
            "com.kakao.talk"                 // 카카오톡 송금 알림도 참고
        )

        fun isListenerEnabled(context: Context): Boolean {
            val cn = ComponentName(context, HojoNotificationListener::class.java)
            val flat = Settings.Secure.getString(
                context.contentResolver,
                "enabled_notification_listeners"
            ) ?: return false
            if (TextUtils.isEmpty(flat)) return false
            return flat.split(":").any {
                ComponentName.unflattenFromString(it) == cn
            }
        }

        fun openListenerSettings(context: Context) {
            val intent = Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS)
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            context.startActivity(intent)
        }
    }
}
