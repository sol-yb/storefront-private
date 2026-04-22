"use client";

import { CircleAlert } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState } from "react";
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
  const t = useTranslations("checkout");
  const [error, setError] = useState<string | null>(null);
  const approvedRef = useRef(false);
  const [approvedForUI, setApprovedForUI] = useState(false);

  const confirmPayment = useCallback(
    async (_returnUrl: string): Promise<{ error?: string }> => {
      if (approvedRef.current) {
        return {};
      }

      // PayPal requires user to approve via the button first.
      // Return an error so the checkout page can inform the user.
      return { error: t("paypalApproveFirst") };
    },
    [t],
  );

  const fetchUpdates = useCallback(async () => {
    // PayPal sessions are managed by the SDK; no manual fetch needed
  }, []);

  // Lazy-load the PayPal SDK components via useEffect with cancellation
  const [PayPalSDK, setPayPalSDK] = useState<{
    PayPalScriptProvider: typeof import("@paypal/react-paypal-js")["PayPalScriptProvider"];
    PayPalButtons: typeof import("@paypal/react-paypal-js")["PayPalButtons"];
  } | null>(null);

  const onReadyRef = useRef(onReady);
  onReadyRef.current = onReady;
  const confirmPaymentRef = useRef(confirmPayment);
  confirmPaymentRef.current = confirmPayment;
  const fetchUpdatesRef = useRef(fetchUpdates);
  fetchUpdatesRef.current = fetchUpdates;

  useEffect(() => {
    if (PayPalSDK) return;

    let cancelled = false;

    import("@paypal/react-paypal-js").then((mod) => {
      if (cancelled) return;
      setPayPalSDK({
        PayPalScriptProvider: mod.PayPalScriptProvider,
        PayPalButtons: mod.PayPalButtons,
      });
      onReadyRef.current({
        confirmPayment: (...args) => confirmPaymentRef.current(...args),
        fetchUpdates: (...args) => fetchUpdatesRef.current(...args),
      });
    });

    return () => {
      cancelled = true;
    };
  }, [PayPalSDK]);

  if (!PayPalSDK) {
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
          }}
          onError={(err) => {
            const msg = err instanceof Error ? err.message : t("paypalError");
            setError(msg);
          }}
          onCancel={() => {
            setError(t("paypalCancelled"));
          }}
        />
      </PayPalScriptProvider>

      {approvedForUI && (
        <p className="text-sm text-green-600 mt-2 text-center">
          {t("paypalApproved")}
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
