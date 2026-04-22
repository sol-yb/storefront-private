"use client";

import { CircleAlert } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import "@adyen/adyen-web/styles/adyen.css";
import {
  adyenClientKey,
  adyenEnvironment,
  isAdyenConfigured,
} from "@/lib/utils/payment-gateway";

export interface AdyenPaymentFormHandle {
  confirmPayment: (returnUrl: string) => Promise<{ error?: string }>;
  fetchUpdates: () => Promise<void>;
}

interface AdyenPaymentFormProps {
  sessionId: string;
  sessionData: string;
  onReady: (handle: AdyenPaymentFormHandle) => void;
  /** Called when the Adyen Drop-in completes payment successfully. */
  onApproved: () => void;
}

function AdyenPaymentFormInner({
  sessionId,
  sessionData,
  onReady,
  onApproved,
}: AdyenPaymentFormProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const dropinRef = useRef<any>(null);
  const [error, setError] = useState<string | null>(null);
  const initializedRef = useRef(false);

  const onApprovedRef = useRef(onApproved);
  onApprovedRef.current = onApproved;

  // Adyen Drop-in with sessions flow manages its own submit via its
  // built-in Pay button. confirmPayment checks if payment already completed.
  const approvedRef = useRef(false);
  const confirmPayment = useCallback(
    async (_returnUrl: string): Promise<{ error?: string }> => {
      if (approvedRef.current) {
        return {};
      }
      // Adyen handles submit internally via its own Pay button
      return { error: "Please complete payment using the Adyen form." };
    },
    [],
  );

  const fetchUpdates = useCallback(async () => {}, []);

  useEffect(() => {
    if (initializedRef.current) return;
    if (!containerRef.current) return;
    initializedRef.current = true;

    let cancelled = false;

    async function init() {
      try {
        const adyen = await import("@adyen/adyen-web");
        const {
          AdyenCheckout,
          Dropin,
          Card,
          GooglePay,
          ApplePay,
          PayPal,
          Klarna,
          Bancontact,
          Redirect,
        } = adyen;
        if (cancelled || !containerRef.current) return;

        AdyenCheckout.register(
          Card,
          GooglePay,
          ApplePay,
          PayPal,
          Klarna,
          Bancontact,
          Redirect,
        );

        const checkout = await AdyenCheckout({
          clientKey: adyenClientKey,
          environment: adyenEnvironment,
          session: {
            id: sessionId,
            sessionData,
          },
          // Show Adyen's own Pay button — sessions flow handles payment internally
          showPayButton: true,
          onPaymentCompleted: (result) => {
            if (
              result.resultCode === "Authorised" ||
              result.resultCode === "Pending" ||
              result.resultCode === "Received"
            ) {
              approvedRef.current = true;
              setError(null);
              onApprovedRef.current();
            } else {
              const msg = `Payment ${result.resultCode?.toLowerCase() || "failed"}. Please try again.`;
              setError(msg);
            }
          },
          onPaymentFailed: (result) => {
            const msg = `Payment ${result?.resultCode?.toLowerCase() || "failed"}. Please try again.`;
            setError(msg);
          },
          onError: (err) => {
            const msg = err?.message || "An error occurred during payment.";
            setError(msg);
          },
        });

        if (cancelled || !containerRef.current) return;

        const dropin = new Dropin(checkout, {
          openFirstPaymentMethod: true,
          paymentMethodComponents: [
            Card,
            GooglePay,
            ApplePay,
            PayPal,
            Klarna,
            Bancontact,
            Redirect,
          ],
        });

        // Mount into a non-React-managed DOM node to avoid Preact/React conflicts
        const mountNode = document.createElement("div");
        containerRef.current.appendChild(mountNode);
        dropin.mount(mountNode);
        dropinRef.current = dropin;
        onReady({ confirmPayment, fetchUpdates });
      } catch (err) {
        initializedRef.current = false;
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : "Failed to initialize payment form.",
          );
        }
      }
    }

    init();

    return () => {
      cancelled = true;
      try {
        dropinRef.current?.unmount();
      } catch {
        // unmount can throw if not mounted
      }
      if (containerRef.current) {
        containerRef.current.innerHTML = "";
      }
      initializedRef.current = false;
    };
  }, [sessionId, sessionData, onReady, confirmPayment, fetchUpdates]);

  return (
    <div>
      <div ref={containerRef} />
      {error && (
        <Alert variant="destructive" className="mt-3">
          <CircleAlert />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
    </div>
  );
}

export function AdyenPaymentForm(props: AdyenPaymentFormProps) {
  if (!isAdyenConfigured) {
    return null;
  }

  return <AdyenPaymentFormInner {...props} />;
}
