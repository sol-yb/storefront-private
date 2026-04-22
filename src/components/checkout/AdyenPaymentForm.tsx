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
}

function AdyenPaymentFormInner({
  sessionId,
  sessionData,
  onReady,
}: AdyenPaymentFormProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  // Adyen SDK types use Preact internally — use a loose ref to avoid
  // coupling to their internal component hierarchy.
  const dropinRef = useRef<any>(null);
  const resolvePaymentRef = useRef<
    ((result: { error?: string }) => void) | null
  >(null);
  const [error, setError] = useState<string | null>(null);
  const initializedRef = useRef(false);

  const confirmPayment = useCallback(
    async (_returnUrl: string): Promise<{ error?: string }> => {
      if (!dropinRef.current) {
        return { error: "Adyen has not loaded yet" };
      }

      // The Drop-in handles its own submit flow. We trigger it
      // programmatically and wait for onPaymentCompleted/onPaymentFailed.
      return new Promise<{ error?: string }>((resolve) => {
        resolvePaymentRef.current = resolve;
        try {
          dropinRef.current.submit();
        } catch (err) {
          resolve({
            error:
              err instanceof Error
                ? err.message
                : "An error occurred during payment.",
          });
          resolvePaymentRef.current = null;
        }
      });
    },
    [],
  );

  const fetchUpdates = useCallback(async () => {
    // Adyen sessions auto-update; no manual fetch needed
  }, []);

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

        // Register payment method components globally so Drop-in can use them
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
          showPayButton: false,
          onPaymentCompleted: (result) => {
            if (
              result.resultCode === "Authorised" ||
              result.resultCode === "Pending" ||
              result.resultCode === "Received"
            ) {
              resolvePaymentRef.current?.({});
            } else {
              const msg = `Payment ${result.resultCode?.toLowerCase() || "failed"}. Please try again.`;
              setError(msg);
              resolvePaymentRef.current?.({ error: msg });
            }
            resolvePaymentRef.current = null;
          },
          onPaymentFailed: () => {
            const msg = "An error occurred during payment.";
            setError(msg);
            resolvePaymentRef.current?.({ error: msg });
            resolvePaymentRef.current = null;
          },
          onError: (err) => {
            const msg = err?.message || "An error occurred during payment.";
            setError(msg);
            resolvePaymentRef.current?.({ error: msg });
            resolvePaymentRef.current = null;
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

        // Mount into a non-React-managed DOM node to avoid Preact/React conflicts.
        // The Adyen SDK uses Preact internally; mounting directly into a React ref
        // causes Preact's render() to silently fail because React owns that DOM node.
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
      // Clean up the imperatively created mount node
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
