package com.santete.statetest

import android.os.Bundle
import androidx.appcompat.app.AppCompatActivity

/**
 * Minimal debuggable test activity — onCreate write SharedPreferences key
 * `m4_state_test_key=ok` để integration spec qua `mobile:executeScript` lookup.
 *
 * Plan ref: M4 Task 13.
 *
 * 2 prefs file:
 *   1. Default prefs (`com.santete.statetest_preferences.xml`) — match
 *      `PreferenceManager.getDefaultSharedPreferences()` lookup pattern.
 *   2. Custom prefs file `state_test_prefs.xml` — match explicit-name lookup.
 *
 * Cả 2 lookup variants để integration spec test cả 2 path.
 */
class MainActivity : AppCompatActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        val defaultPrefs = getSharedPreferences(
            "${packageName}_preferences",
            MODE_PRIVATE
        )
        defaultPrefs.edit().putString("m4_state_test_key", "ok").apply()

        val customPrefs = getSharedPreferences("state_test_prefs", MODE_PRIVATE)
        customPrefs.edit().putString("m4_state_test_key", "ok").apply()
    }
}
