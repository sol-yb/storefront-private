import { CartProvider } from "@/contexts/CartContext";
import { getCustomer } from "@/lib/data/customer";
import { getWholesaleChannel } from "@/lib/data/wholesale";
import { isWholesaleApproved } from "@/lib/wholesale";
import { WholesaleApplicationPending } from "./WholesaleApplicationPending";
import { WholesaleHeader } from "./WholesaleHeader";
import { WholesaleSignInWall } from "./WholesaleSignInWall";

interface WholesaleGateProps {
  basePath: string;
  children: React.ReactNode;
}

/**
 * Server-side gate for the approved-buyer areas of the portal (catalog, PDP,
 * cart, quick order). Branches on the session + Wholesale-group membership:
 *
 * - guest → inline sign-in / apply wall (never redirects to the DTC account)
 * - authenticated, not approved → application-pending state
 * - approved member → the portal chrome + `children`, with the wholesale cart
 *   bound via <CartProvider surface="wholesale">
 *
 * Runs per navigation, so a login (which triggers a server re-render)
 * re-evaluates it. The apply page renders outside this gate so guests can
 * reach it.
 */
export async function WholesaleGate({
  basePath,
  children,
}: WholesaleGateProps) {
  const [customer, channel] = await Promise.all([
    getCustomer(),
    getWholesaleChannel(),
  ]);

  if (!customer) {
    return (
      <WholesaleSignInWall
        basePath={basePath}
        storefrontAccess={channel?.storefront_access}
      />
    );
  }

  if (!isWholesaleApproved(customer)) {
    return (
      <WholesaleApplicationPending
        basePath={basePath}
        customerName={
          [customer.first_name, customer.last_name].filter(Boolean).join(" ") ||
          customer.email
        }
        email={customer.email}
      />
    );
  }

  const displayName =
    [customer.first_name, customer.last_name].filter(Boolean).join(" ") ||
    customer.email;

  return (
    <CartProvider surface="wholesale">
      <WholesaleHeader basePath={basePath} customerName={displayName} />
      <main>{children}</main>
    </CartProvider>
  );
}
