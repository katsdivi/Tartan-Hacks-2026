import { useState, useEffect, useRef } from "react";
import {
  StyleSheet,
  Text,
  View,
  Pressable,
  Platform,
  ActivityIndicator,
} from "react-native";
import { WebView } from "react-native-webview";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useFinance } from "@/lib/finance-context";
import { createLinkToken } from "@/lib/plaid-service";
import Colors from "@/constants/colors";

export default function PlaidLinkScreen() {
  const insets = useSafeAreaInsets();
  const { connectBank } = useFinance();
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const webViewRef = useRef<WebView>(null);

  useEffect(() => {
    initPlaidLink();
  }, []);

  async function initPlaidLink() {
    try {
      setIsLoading(true);
      setError(null);
      const token = await createLinkToken();
      setLinkToken(token);
    } catch (err) {
      console.error("Failed to create link token:", err);
      setError("Unable to connect to Plaid. Please try again.");
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
        body { margin: 0; padding: 0; background: #F8F9FC; display: flex; align-items: center; justify-content: center; height: 100vh; font-family: -apple-system, BlinkMacSystemFont, sans-serif; }
        .loading { text-align: center; color: #6B7280; }
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
            // console.log('Plaid event:', eventName);
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
        await connectBank(data.public_token);
        router.back();
      } else if (data.type === "exit") {
        router.back();
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
          <Ionicons name="alert-circle" size={48} color={Colors.light.negative} />
          <Text style={styles.errorText}>{error}</Text>
          <Pressable style={styles.retryButton} onPress={initPlaidLink}>
            <Text style={styles.retryButtonText}>Try Again</Text>
          </Pressable>
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
    gap: 16,
    paddingHorizontal: 40,
  },
  loadingText: {
    fontSize: 15,
    fontFamily: "DMSans_400Regular",
    color: Colors.light.textSecondary,
  },
  errorText: {
    fontSize: 15,
    fontFamily: "DMSans_400Regular",
    color: Colors.light.textSecondary,
    textAlign: "center",
    lineHeight: 22,
  },
  retryButton: {
    backgroundColor: Colors.light.tint,
    borderRadius: 14,
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  retryButtonText: {
    fontSize: 15,
    fontFamily: "DMSans_600SemiBold",
    color: "#fff",
  },
});
