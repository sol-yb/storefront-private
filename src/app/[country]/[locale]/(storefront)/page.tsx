import Link from "next/link";
import { ProductCarousel } from "@/components/products/ProductCarousel";

interface HomePageProps {
  params: Promise<{
    country: string;
    locale: string;
  }>;
}

export default async function HomePage({ params }: HomePageProps) {
  const { country, locale } = await params;
  const basePath = `/${country}/${locale}`;

  return (
    <div>
      {/* Hero Section */}
      <section className="border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
          <div className="text-center">
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-gray-900">
              Welcome to Spree Store
            </h1>
            <p className="mt-4 text-xl text-gray-500 max-w-2xl mx-auto">
              Discover amazing products with our modern e-commerce experience
              powered by Spree Commerce.
            </p>
            <div className="mt-8 flex justify-center gap-4">
              <Link
                href={`${basePath}/products`}
                className="bg-gray-900 text-white px-6 py-3 rounded-xl font-medium hover:bg-gray-800 transition-colors"
              >
                Shop Now
              </Link>
              <Link
                href={`${basePath}/taxonomies`}
                className="border border-gray-300 text-gray-700 px-6 py-3 rounded-xl font-medium hover:border-gray-400 hover:bg-gray-50 transition-colors"
              >
                Browse Categories
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Featured Products */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-2xl font-bold text-gray-900">
            Featured Products
          </h2>
          <Link
            href={`${basePath}/products`}
            className="text-primary hover:text-primary font-medium"
          >
            View all &rarr;
          </Link>
        </div>
        <ProductCarousel basePath={basePath} />
      </section>
    </div>
  );
}
