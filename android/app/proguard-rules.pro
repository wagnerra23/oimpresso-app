# Add project specific ProGuard rules here.
# You can control the set of applied configuration files using the
# proguardFiles setting in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# If your project uses WebView with JS, uncomment the following
# and specify the fully qualified class name to the JavaScript interface
# class:
#-keepclassmembers class fqcn.of.javascript.interface.for.webview {
#   public *;
#}

# Uncomment this to preserve the line number information for
# debugging stack traces.
#-keepattributes SourceFile,LineNumberTable

# If you keep the line number information, uncomment this to
# hide the original source file name.
#-renamesourcefileattribute SourceFile

# Contador no ícone (@capawesome/capacitor-badge → ShortcutBadger 1.1.22): o "badger" de cada launcher é
# criado por reflexão (newInstance). As regras do próprio .aar cobrem só 9 deles e deixam de fora Samsung,
# Huawei, OPPO, Vivo, LG, ZUK, ZTE e Everything.me; sem isto o R8 tira o construtor e o contador some.
-keep class me.leolin.shortcutbadger.impl.** { <init>(...); }
