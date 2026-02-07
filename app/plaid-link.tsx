import { useState, useEffect, useRef } from "react";
import {
  StyleSheet,
  Text,
  View,
  Pressable,
  Platform,
  ActivityIndicator,
  Modal,
} from "react-native";
import { WebView } from "react-native-webview";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useFinance } from "@/lib/finance-context";
import { createLinkToken } from "@/lib/plaid-service";
import Colors from "@/constants/colors";

const DEMO_MODE_ENV = process.env.EXPO_PUBLIC_DEMO_MODE === "1";

export default function PlaidLinkScreen() {
  const insets = useSafeAreaInsets();
  const { connectBank, loadDemoData } = useFinance();
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showErrorPopup, setShowErrorPopup] = useState(false);
  const [errorDetail, setErrorDetail] = useState("");
  const webViewRef = useRef<WebView>(null);

  useEffect(() => {
    if (DEMO_MODE_ENV) {
      // If in demo mode, skip Plaid Link and load demo data directly
      loadDemoData();
      router.back();
      return;
    }
    initPlaidLink();
  }, []);

  async function initPlaidLink() {
    try {
      setIsLoading(true);
      setError(null);
      const token = await createLinkToken();
      setLinkToken(token);
    } catch (err: any) {
      console.error("Failed to create link token:", err);
      setErrorDetail("Plaid API connection wasn't successful. This could be due to invalid credentials or a service issue.");
      setShowErrorPopup(true);
      setError("Connection failed");
    } finally {
      setIsLoading(false);
    }
  }

  const plaidHtml = linkToken
    ? `
    <!DOCTYPE html>
    <html>
    <head>
      <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
      <script src="https://cdn.plaid.com/link/v2/stable/link-initialize.js"></script>
      <style>
        body { margin: 0; padding: 0; background: #0A0E1A; display: flex; align-items: center; justify-content: center; height: 100vh; font-family: -apple-system, BlinkMacSystemFont, sans-serif; }
        .loading { text-align: center; color: #8B93A7; }
        .loading p { margin-top: 12px; font-size: 15px; }
      </style>
    </head>
    <body>
      <div class="loading" id="loading">
        <p>Opening secure connection...</p>
      </div>
      <script>
        const handler = Plaid.create({
          token: '${linkToken}',
          onSuccess: function(public_token, metadata) {
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'success',
              public_token: public_token,
              metadata: metadata
            }));
          },
          onExit: function(err, metadata) {
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'exit',
              error: err,
              metadata: metadata
            }));
          },
          onEvent: function(eventName, metadata) {
          },
        });
        handler.open();
      </script>
    </body>
    </html>
  `
    : "";

  const handleMessage = async (event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === "success") {
        try {
          await connectBank(data.public_token);
          router.back();
        } catch (err) {
          setErrorDetail("Plaid API connection wasn't successful. Token exchange failed.");
          setShowErrorPopup(true);
        }
      } else if (data.type === "exit") {
        if (data.error) {
          setErrorDetail(`Plaid connection was cancelled or encountered an error: ${data.error.display_message || data.error.error_message || "Unknown error"}`);
          setShowErrorPopup(true);
        } else {
          router.back();
        }
      }
    } catch (err) {
      console.error("WebView message error:", err);
    }
  };

  const topInset = Platform.OS === "web" ? 67 : insets.top;

  return (
    <View style={[styles.container, { paddingTop: topInset }]}>
      <View style={styles.header}>
        <Pressable
          style={({ pressed }) => [styles.closeButton, pressed && { opacity: 0.7 }]}
          onPress={() => router.back()}
        >
          <Ionicons name="close" size={24} color={Colors.light.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Connect Bank</Text>
        <View style={{ width: 40 }} />
      </View>

      {isLoading ? (
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color={Colors.light.tint} />
          <Text style={styles.loadingText}>Preparing secure connection...</Text>
        </View>
      ) : error ? (
        <View style={styles.centerContent}>
          <View style={styles.errorIconWrap}>
            <Ionicons name="alert-circle" size={40} color={Colors.light.negative} />
          </View>
          <Text style={styles.errorText}>Unable to connect to Plaid</Text>
          <Text style={styles.errorSubtext}>You can retry or use demo data to explore the app</Text>
          <View style={styles.errorBtns}>
            <Pressable style={styles.retryButton} onPress={initPlaidLink}>
              <Text style={styles.retryButtonText}>Retry</Text>
            </Pressable>
            <Pressable
              style={styles.demoBtnAlt}
              onPress={() => {
                loadDemoData();
                router.back();
              }}
            >
              <Text style={styles.demoBtnAltText}>Use Demo Data</Text>
            </Pressable>
          </View>
        </View>
      ) : linkToken ? (
        <WebView
          ref={webViewRef}
          source={{ html: plaidHtml }}
          onMessage={handleMessage}
          style={styles.webview}
          javaScriptEnabled
          domStorageEnabled
          startInLoadingState
          renderLoading={() => (
            <View style={styles.webviewLoading}>
              <ActivityIndicator size="large" color={Colors.light.tint} />
            </View>
          )}
        />
      ) : null}

      <Modal visible={showErrorPopup} transparent animationType="fade">
        <View style={styles.popupOverlay}>
          <View style={styles.popupCard}>
            <Pressable style={styles.popupClose} onPress={() => setShowErrorPopup(false)}>
              <Ionicons name="close" size={20} color={Colors.light.textSecondary} />
            </Pressable>
            <View style={styles.popupIconWrap}>
              <Ionicons name="alert-circle" size={36} color={Colors.light.negative} />
            </View>
            <Text style={styles.popupTitle}>Connection Error</Text>
            <Text style={styles.popupMessage}>{errorDetail}</Text>
            <View style={styles.popupActions}>
              <Pressable
                style={styles.popupDemoBtn}
                onPress={() => {
                  setShowErrorPopup(false);
                  loadDemoData();
                  router.back();
                }}
              >
                <Text style={styles.popupDemoBtnText}>Use Demo Data</Text>
              </Pressable>
              <Pressable
                style={styles.popupDismissBtn}
                onPress={() => {
                  setShowErrorPopup(false);
                  router.back();
                }}
              >
                <Text style={styles.popupDismissBtnText}>Dismiss</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.light.background,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.light.surfaceElevated,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 17,
    fontFamily: "DMSans_600SemiBold",
    color: Colors.light.text,
  },
  webview: {
    flex: 1,
  },
  webviewLoading: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.light.background,
  },
  centerContent: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    paddingHorizontal: 40,
  },
  loadingText: {
    fontSize: 15,
    fontFamily: "DMSans_400Regular",
    color: Colors.light.textSecondary,
  },
  errorIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: Colors.light.negativeLight,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  errorText: {
    fontSize: 18,
    fontFamily: "DMSans_600SemiBold",
    color: Colors.light.text,
    textAlign: "center",
  },
  errorSubtext: {
    fontSize: 14,
    fontFamily: "DMSans_400Regular",
    color: Colors.light.textSecondary,
    textAlign: "center",
    lineHeight: 20,
  },
  errorBtns: {
    gap: 10,
    marginTop: 8,
    width: "100%",
    maxWidth: 240,
  },
  retryButton: {
    backgroundColor: Colors.light.tint,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
  },
  retryButtonText: {
    fontSize: 15,
    fontFamily: "DMSans_600SemiBold",
    color: Colors.light.background,
  },
  demoBtnAlt: {
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  demoBtnAltText: {
    fontSize: 14,
    fontFamily: "DMSans_500Medium",
    color: Colors.light.textSecondary,
  },
  popupOverlay: {
    flex: 1,
    backgroundColor: Colors.light.overlay,
    justifyContent: "center",
    alignItems: "center",
    padding: 32,
  },
  popupCard: {
    backgroundColor: Colors.light.surface,
    borderRadius: 20,
    padding: 28,
    width: "100%",
    maxWidth: 340,
    alignItems: "center",
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  popupClose: {
    position: "absolute",
    top: 14,
    right: 14,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: Colors.light.surfaceElevated,
    alignItems: "center",
    justifyContent: "center",
  },
  popupIconWrap: {
    width: 60,
    height: 60,
    borderRadius: 18,
    backgroundColor: Colors.light.negativeLight,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  popupTitle: {
    fontSize: 18,
    fontFamily: "DMSans_700Bold",
    color: Colors.light.text,
    marginBottom: 8,
  },
  popupMessage: {
    fontSize: 14,
    fontFamily: "DMSans_400Regular",
    color: Colors.light.textSecondary,
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 20,
  },
  popupActions: {
    width: "100%",
    gap: 10,
  },
  popupDemoBtn: {
    backgroundColor: Colors.light.tint,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
  },
  popupDemoBtnText: {
    fontSize: 15,
    fontFamily: "DMSans_600SemiBold",
    color: Colors.light.background,
  },
  popupDismissBtn: {
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  popupDismissBtnText: {
    fontSize: 14,
    fontFamily: "DMSans_500Medium",
    color: Colors.light.textSecondary,
  },
});
