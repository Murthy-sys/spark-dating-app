/**
 * RazorpayCheckout.tsx
 *
 * Loads Razorpay Standard Checkout inside a WebView for a given subscription_id
 * and bridges the success/failure events back to React Native.
 *
 * Why WebView (vs `react-native-razorpay`):
 *  - Works in Expo Go and any web platform
 *  - No native rebuild needed
 *  - Razorpay's hosted checkout owns the autopay-mandate UX and stays current
 *
 * The hosted page calls window.ReactNativeWebView.postMessage(...) on success,
 * dismiss, or error. The parent screen handles the message and verifies the
 * payment server-side.
 */

import React from 'react';
import { Modal, View, ActivityIndicator, StyleSheet, TouchableOpacity, Text, Platform } from 'react-native';
import { WebView, WebViewMessageEvent } from 'react-native-webview';

export interface RazorpayCheckoutResult {
  type: 'success' | 'dismissed' | 'error';
  // Present on type='success'
  razorpay_payment_id?:      string;
  razorpay_subscription_id?: string;
  razorpay_signature?:       string;
  // Present on type='error'
  code?:        string;
  description?: string;
}

interface Props {
  visible:        boolean;
  keyId:          string;
  subscriptionId: string;
  prefill?: {
    name?:    string;
    email?:   string;
    contact?: string;
  };
  themeColor?: string;
  description?: string;
  /** Public URL to a square logo (Razorpay shows it in the checkout sheet). */
  imageUrl?:   string;
  /** Merchant name shown in the checkout header (overrides Razorpay account default). */
  merchantName?: string;
  onClose: (result: RazorpayCheckoutResult) => void;
}

function buildCheckoutHtml(opts: {
  keyId:          string;
  subscriptionId: string;
  prefill:        { name?: string; email?: string; contact?: string };
  themeColor:     string;
  description:    string;
  imageUrl?:      string;
  merchantName:   string;
}): string {
  // The checkout script is loaded directly from Razorpay's CDN. We pass the
  // subscription_id (created server-side) — Razorpay handles the autopay
  // mandate flow and emits handler() with the signature on success.
  const safe = (s: string | undefined) => (s ? s.replace(/'/g, "\\'") : '');
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
  <title>Spark Premium Checkout</title>
  <style>
    html, body { margin: 0; padding: 0; height: 100%; background: #fff; font-family: -apple-system, BlinkMacSystemFont, sans-serif; }
    .wrap { display: flex; align-items: center; justify-content: center; height: 100%; flex-direction: column; gap: 12px; }
    .spin { width: 40px; height: 40px; border-radius: 50%; border: 3px solid #FFE5EA; border-top-color: #FF4B6E; animation: r 1s linear infinite; }
    @keyframes r { to { transform: rotate(360deg); } }
    .msg { color: #888; font-size: 14px; }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="spin"></div>
    <div class="msg">Opening secure checkout…</div>
  </div>
  <script src="https://checkout.razorpay.com/v1/checkout.js"></script>
  <script>
    (function() {
      function send(data) {
        try {
          if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
            window.ReactNativeWebView.postMessage(JSON.stringify(data));
          }
        } catch (e) {}
      }

      var options = {
        key:             '${safe(opts.keyId)}',
        subscription_id: '${safe(opts.subscriptionId)}',
        name:            '${safe(opts.merchantName)}',
        description:     '${safe(opts.description)}',
        ${opts.imageUrl ? `image:           '${safe(opts.imageUrl)}',` : ''}
        theme:           { color: '${safe(opts.themeColor)}' },
        prefill: {
          name:    '${safe(opts.prefill.name)}',
          email:   '${safe(opts.prefill.email)}',
          contact: '${safe(opts.prefill.contact)}'
        },
        handler: function (response) {
          send({
            type: 'success',
            razorpay_payment_id:      response.razorpay_payment_id,
            razorpay_subscription_id: response.razorpay_subscription_id,
            razorpay_signature:       response.razorpay_signature
          });
        },
        modal: {
          ondismiss: function () { send({ type: 'dismissed' }); },
          escape:    true
        }
      };

      try {
        var rzp = new Razorpay(options);
        rzp.on('payment.failed', function (resp) {
          send({
            type:        'error',
            code:        resp && resp.error ? resp.error.code : 'UNKNOWN',
            description: resp && resp.error ? resp.error.description : 'Payment failed'
          });
        });
        // Open immediately; Razorpay auto-handles the spinner inside its UI.
        rzp.open();
      } catch (e) {
        send({ type: 'error', code: 'INIT_FAILED', description: String(e && e.message || e) });
      }
    })();
  </script>
</body>
</html>`;
}

export default function RazorpayCheckout({
  visible,
  keyId,
  subscriptionId,
  prefill = {},
  themeColor = '#FF4B6E',
  description = 'Monthly autopay subscription',
  imageUrl,
  merchantName = 'Spark',
  onClose,
}: Props) {
  if (!visible) return null;

  const html = buildCheckoutHtml({
    keyId,
    subscriptionId,
    prefill,
    themeColor,
    description,
    imageUrl,
    merchantName,
  });

  const handleMessage = (event: WebViewMessageEvent) => {
    try {
      const data = JSON.parse(event.nativeEvent.data) as RazorpayCheckoutResult;
      onClose(data);
    } catch {
      onClose({ type: 'error', description: 'Bad message from checkout' });
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={() => onClose({ type: 'dismissed' })}
    >
      <View style={styles.root}>
        <View style={styles.headerBar}>
          <TouchableOpacity onPress={() => onClose({ type: 'dismissed' })} style={styles.closeBtn}>
            <Text style={styles.closeText}>Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Spark Premium</Text>
          <View style={{ width: 60 }} />
        </View>
        <WebView
          originWhitelist={['*']}
          source={{ html, baseUrl: 'https://checkout.razorpay.com' }}
          onMessage={handleMessage}
          startInLoadingState
          renderLoading={() => (
            <View style={styles.loading}>
              <ActivityIndicator size="large" color="#FF4B6E" />
            </View>
          )}
          javaScriptEnabled
          domStorageEnabled
          // Important on Android — Razorpay's checkout uses third-party content
          mixedContentMode="always"
          // Avoid blocking embedded iframes (cards/UPI screens)
          allowsInlineMediaPlayback
          style={styles.web}
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root:      { flex: 1, backgroundColor: '#fff' },
  headerBar: {
    flexDirection:    'row',
    alignItems:       'center',
    justifyContent:   'space-between',
    paddingHorizontal: 16,
    paddingTop:       Platform.OS === 'ios' ? 50 : 16,
    paddingBottom:    12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    backgroundColor:   '#fff',
  },
  closeBtn:  { paddingVertical: 6, paddingHorizontal: 4 },
  closeText: { color: '#FF4B6E', fontSize: 16, fontWeight: '600' },
  title:     { fontSize: 17, fontWeight: '700', color: '#1A1A1A' },
  web:       { flex: 1, backgroundColor: '#fff' },
  loading:   { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' },
});
