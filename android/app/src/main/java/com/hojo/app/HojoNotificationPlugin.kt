package com.hojo.app

import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin

@CapacitorPlugin(name = "HojoNotifications")
class HojoNotificationPlugin : Plugin() {

    override fun load() {
        super.load()
        instance = this
    }

    @PluginMethod
    fun isListenerEnabled(call: PluginCall) {
        val ret = JSObject()
        ret.put("enabled", HojoNotificationListener.isListenerEnabled(context))
        call.resolve(ret)
    }

    @PluginMethod
    fun openListenerSettings(call: PluginCall) {
        HojoNotificationListener.openListenerSettings(context)
        call.resolve()
    }

    companion object {
        @Volatile private var instance: HojoNotificationPlugin? = null

        fun emitNotification(pkg: String, title: String, body: String, postedAt: Long, key: String) {
            val plugin = instance ?: return
            val payload = JSObject().apply {
                put("pkg", pkg)
                put("title", title)
                put("body", body)
                put("postedAt", postedAt)
                put("key", key)
            }
            plugin.notifyListeners("notificationPosted", payload)
        }
    }
}
