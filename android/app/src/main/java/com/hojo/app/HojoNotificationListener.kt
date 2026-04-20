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
        val title = extras.getCharSequence("android.title")?.toString()
            ?: extras.getCharSequence("android.title.big")?.toString()
            ?: ""
        val text = extras.getCharSequence("android.text")?.toString() ?: ""
        val bigText = extras.getCharSequence("android.bigText")?.toString() ?: ""
        val summary = extras.getCharSequence("android.summaryText")?.toString() ?: ""
        val subText = extras.getCharSequence("android.subText")?.toString() ?: ""
        val infoText = extras.getCharSequence("android.infoText")?.toString() ?: ""
        val textLines = extras.getCharSequenceArray("android.textLines")
            ?.joinToString("\n") { it?.toString() ?: "" }
            ?: ""
        val ticker = sbn.notification?.tickerText?.toString() ?: ""

        val body = listOf(bigText, text, textLines, summary, subText, infoText, ticker)
            .filter { it.isNotBlank() }
            .distinct()
            .joinToString("\n")

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
            // 카드사
            "com.hyundaicard.appcard",       // 현대카드
            "nh.smart.card",                 // 농협카드
            "com.shcard.smartpay",           // 신한카드
            "com.kbcard.cxh.appcard",        // 국민카드
            "kr.co.samsungcard.mpocket",     // 삼성카드
            "com.lcacApp",                   // 롯데카드
            "com.hanaskcard.paycla",         // 하나카드
            "com.citibank.cardapp",          // 씨티카드
            "com.bccard.smartcard",          // BC카드
            // 은행/뱅크
            "viva.republica.toss",           // 토스
            "com.tossbank.mobile",           // 토스뱅크
            "com.kakaobank.channel",         // 카카오뱅크
            "nh.smart",                      // NH스마트뱅킹
            "com.kbstar.liivbank",           // KB리브
            "com.shinhan.sbanking",          // 신한SOL
            // 간편결제
            "com.kakaopay.app",              // 카카오페이
            "com.naver.nownpay",             // 네이버페이
            "com.nhn.android.search",        // 네이버
            // 메신저 (송금 알림)
            "com.kakao.talk"
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
