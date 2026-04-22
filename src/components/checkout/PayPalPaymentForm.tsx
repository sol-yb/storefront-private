"use client";

import { CircleAlert } from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  isPayPalConfigured,
  paypalClientId,
} from "@/lib/utils/payment-gateway";

export interface PayPalPaymentFormHandle {
  confirmPayment: (returnUrl: string) => Promise<{ error?: string }>;
  fetchUpdates: () => Promise<void>;
}

interface PayPalPaymentFormProps {
  paypalOrderId: string;
  currency: string;
  onReady: (handle: PayPalPaymentFormHandle) => void;
}

function PayPalPaymentFormInner({
  paypalOrderId,
  currency,
  onReady,
}: PayPalPaymentFormProps) {
  const [error, setError] = useState<string | null>(null);
  const approvedRef = useRef(false);
  const [approvedForUI, setApprovedForUI] = useState(false);
  const resolvePaymentRef = useRef<
    ((result: { error?: string }) => void) | null
  >(null);

  // Use a stable ref-based confirmPayment so the handle never goes stale
  const confirmPayment = useCallback(
    async (_returnUrl: string): Promise<{ error?: string }> => {
      if (approvedRef.current) {
        return {};
      }

      // Wait for the user to complete the PayPal flow via the button.
      // The PayPalButtons onApprove callback will resolve this promise.
      return new Promise<{ error?: string }>((resolve) => {
        resolvePaymentRef.current = resolve;
      });
    },
    [],
  );

  const fetchUpdates = useCallback(async () => {
    // PayPal sessions are managed by the SDK; no manual fetch needed
  }, []);

  // Lazy-load the PayPal SDK components
  const [PayPalSDK, setPayPalSDK] = useState<{
    PayPalScriptProvider: typeof import("@paypal/react-paypal-js")["PayPalScriptProvider"];
    PayPalButtons: typeof import("@paypal/react-paypal-js")["PayPalButtons"];
  } | null>(null);

  // Dynamic import of PayPal React SDK
  if (!PayPalSDK) {
    import("@paypal/react-paypal-js").then((mod) => {
      setPayPalSDK({
        PayPalScriptProvider: mod.PayPalScriptProvider,
        PayPalButtons: mod.PayPalButtons,
      });
      onReady({ confirmPayment, fetchUpdates });
    });

    return (
      <div className="flex items-center justify-center py-8">
        <div className="w-5 h-5 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
      </div>
    );
  }

  const { PayPalScriptProvider, PayPalButtons } = PayPalSDK;

  return (
    <div>
      <PayPalScriptProvider
        options={{
          clientId: paypalClientId,
          currency: currency.toUpperCase(),
          intent: "capture",
        }}
      >
        <PayPalButtons
          style={{
            shape: "rect",
            layout: "vertical",
            color: "gold",
            label: "paypal",
          }}
          createOrder={async () => {
            // Return the PayPal order ID created by Spree's payment session.
            // No need to call PayPal API — the order already exists.
            return paypalOrderId;
          }}
          onApprove={async () => {
            // User approved the payment in the PayPal popup.
            // The actual capture happens in Spree's completePaymentSession.
            approvedRef.current = true;
            setApprovedForUI(true);
            setError(null);
            resolvePaymentRef.current?.({});
            resolvePaymentRef.current = null;
          }}
          onError={(err) => {
            const msg =
              err instanceof Error
                ? err.message
                : "An error occurred with PayPal. Please try again.";
            setError(msg);
            resolvePaymentRef.current?.({ error: msg });
            resolvePaymentRef.current = null;
          }}
          onCancel={() => {
            resolvePaymentRef.current?.({
              error: "PayPal payment was cancelled.",
            });
            resolvePaymentRef.current = null;
          }}
        />
      </PayPalScriptProvider>

      {approvedForUI && (
        <p className="text-sm text-green-600 mt-2 text-center">
          PayPal payment approved. Completing your order...
        </p>
      )}

      {error && (
        <Alert variant="destructive" className="mt-3">
          <CircleAlert />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
    </div>
  );
}

export function PayPalPaymentForm(props: PayPalPaymentFormProps) {
  if (!isPayPalConfigured) {
    return null;
  }

  return <PayPalPaymentFormInner {...props} />;
}
