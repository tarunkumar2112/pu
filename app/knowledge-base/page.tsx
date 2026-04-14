"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";

const BRAND_BLUE = "#1F2B44";
const LOGO_URL = "https://cdn.prod.website-files.com/67ee6c6b271e5a2294abc43e/6814932c8fdab74d7cd6845d_Group%201577708998.webp";

const guides = [
  {
    id: "upload-products",
    title: "Upload Products from Treez to Database and Opticon",
    icon: "🚀",
    description: "Step-by-step guide to setup initial product sync",
  },
  {
    id: "how-sync-works",
    title: "How Sync Works",
    icon: "🔄",
    description: "Understanding the real-time sync process",
  },
];

export default function KnowledgeBasePage() {
  const [selectedGuide, setSelectedGuide] = useState("upload-products");

  return (
    <div className="min-h-screen bg-zinc-50">
      {/* Header */}
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto max-w-7xl px-8 py-6 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <Image
              src={LOGO_URL}
              alt="Perfect Union"
              width={120}
              height={36}
              className="h-9 w-auto object-contain"
              unoptimized
            />
          </Link>
          <Link
            href="/admin"
            className="rounded-lg px-4 py-2 text-sm font-medium text-white transition hover:opacity-90"
            style={{ backgroundColor: BRAND_BLUE }}
          >
            Open Dashboard
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-7xl px-8 py-12">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-zinc-900 mb-3">
            Knowledge Base
          </h1>
          <p className="text-lg text-zinc-600">
            Learn how to use the Perfect Union ESL Sync System
          </p>
        </div>

        <div className="flex gap-8">
          {/* Sidebar */}
          <aside className="w-64 flex-shrink-0">
            <div className="bg-white rounded-lg border border-zinc-200 p-4 space-y-2 sticky top-8">
              {guides.map((guide) => (
                <button
                  key={guide.id}
                  onClick={() => setSelectedGuide(guide.id)}
                  className={`w-full text-left px-4 py-3 rounded-lg text-sm font-medium transition ${
                    selectedGuide === guide.id
                      ? "bg-zinc-100 text-zinc-900"
                      : "text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-lg">{guide.icon}</span>
                    <span>{guide.title}</span>
                  </div>
                </button>
              ))}
            </div>
          </aside>

          {/* Content Area */}
          <div className="flex-1">
            {selectedGuide === "upload-products" && <UploadProductsGuide />}
            {selectedGuide === "how-sync-works" && <HowSyncWorksGuide />}
          </div>
        </div>
      </main>
    </div>
  );
}

function UploadProductsGuide() {
  return (
    <div className="bg-white rounded-lg border border-zinc-200 p-8">
      <h2 className="text-2xl font-bold text-zinc-900 mb-6">
        Upload Products from Treez to Database and Opticon
      </h2>

      {/* Step 1 */}
      <div className="mb-8 pb-8 border-b border-zinc-200">
        <div className="flex items-start gap-4 mb-4">
          <div className="flex-shrink-0 w-10 h-10 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold">
            1
          </div>
          <div className="flex-1">
            <h3 className="text-xl font-semibold text-zinc-900 mb-3">
              Login to Treez Portal
            </h3>
            <ol className="space-y-2 text-zinc-700 list-decimal list-inside">
              <li>Navigate to your Treez dashboard</li>
              <li>Select your store location from the dropdown (e.g., "Perfect Union - Sac NorthSide")</li>
              <li>Click on <strong>Product</strong> in the left sidebar</li>
              <li>Click on <strong>Product List</strong></li>
            </ol>
            <div className="mt-4 border border-zinc-200 rounded-lg overflow-hidden">
              <img 
                src="/screenshots/treez-product-menu.png"
                alt="Treez dashboard with Product menu"
                className="w-full"
              />
              <div className="bg-zinc-50 px-4 py-2 text-sm text-zinc-600 border-t border-zinc-200">
                <strong>Screenshot 1:</strong> Navigate to Product → Product List in Treez portal
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Step 2 */}
      <div className="mb-8 pb-8 border-b border-zinc-200">
        <div className="flex items-start gap-4 mb-4">
          <div className="flex-shrink-0 w-10 h-10 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold">
            2
          </div>
          <div className="flex-1">
            <h3 className="text-xl font-semibold text-zinc-900 mb-3">
              Filter Products with ESL Tag
            </h3>
            <ol className="space-y-2 text-zinc-700 list-decimal list-inside">
              <li>In the search box, type <strong>ESL</strong></li>
              <li>The system will display all products tagged with "ESL"</li>
              <li>You should see the total count (e.g., "Displaying first 25 results of 36354")</li>
            </ol>
            <div className="mt-4 border border-zinc-200 rounded-lg overflow-hidden">
              <img 
                src="/screenshots/treez-esl-filter.png"
                alt="Product list filtered by ESL tag"
                className="w-full"
              />
              <div className="bg-zinc-50 px-4 py-2 text-sm text-zinc-600 border-t border-zinc-200">
                <strong>Screenshot 2:</strong> Search for "ESL" to filter products with ESL tags
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Step 3 */}
      <div className="mb-8 pb-8 border-b border-zinc-200">
        <div className="flex items-start gap-4 mb-4">
          <div className="flex-shrink-0 w-10 h-10 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold">
            3
          </div>
          <div className="flex-1">
            <h3 className="text-xl font-semibold text-zinc-900 mb-3">
              Export Products to CSV
            </h3>
            <ol className="space-y-2 text-zinc-700 list-decimal list-inside">
              <li>Click on the <strong>three dots menu (⋮)</strong> in the top right corner</li>
              <li>Select <strong>CSV Export</strong> from the dropdown</li>
              <li>The CSV file will download automatically</li>
              <li>Open the CSV file in Excel or any spreadsheet application</li>
            </ol>
            <div className="mt-4 border border-zinc-200 rounded-lg overflow-hidden">
              <img 
                src="/screenshots/treez-csv-export.png"
                alt="Three dots menu with CSV Export option"
                className="w-full"
              />
              <div className="bg-zinc-50 px-4 py-2 text-sm text-zinc-600 border-t border-zinc-200">
                <strong>Screenshot 3:</strong> Click three dots menu and select CSV Export
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Step 4 */}
      <div className="mb-8 pb-8 border-b border-zinc-200">
        <div className="flex items-start gap-4 mb-4">
          <div className="flex-shrink-0 w-10 h-10 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold">
            4
          </div>
          <div className="flex-1">
            <h3 className="text-xl font-semibold text-zinc-900 mb-3">
              Copy Product IDs from Excel
            </h3>
            <ol className="space-y-2 text-zinc-700 list-decimal list-inside">
              <li>Open the downloaded CSV file in Excel</li>
              <li>The <strong>first column (Column A)</strong> contains all Product IDs</li>
              <li>Select all Product IDs in Column A (excluding header)</li>
              <li>Copy them (Ctrl+C or Cmd+C)</li>
            </ol>
            <div className="mt-4 border border-zinc-200 rounded-lg overflow-hidden">
              <img 
                src="/screenshots/excel-product-ids.png"
                alt="Excel file showing Product IDs in Column A"
                className="w-full"
              />
              <div className="bg-zinc-50 px-4 py-2 text-sm text-zinc-600 border-t border-zinc-200">
                <strong>Screenshot 4:</strong> Excel file showing Product IDs in Column A (first column)
              </div>
            </div>
            <div className="mt-4 bg-zinc-50 rounded-lg p-4">
              <p className="text-sm text-zinc-600 mb-2">
                <strong>Example Product IDs:</strong>
              </p>
              <pre className="text-xs bg-white border rounded p-2 overflow-x-auto">
1060459d-bec9-48cf-a779-9f7ae5761337
4df8b3f6-ea86-4b3f-9e0c-066f828f6d9a
3db96861-236b-4dbf-81ca-10347412aa5e
...</pre>
            </div>
          </div>
        </div>
      </div>

      {/* Step 5 */}
      <div className="mb-8 pb-8 border-b border-zinc-200">
        <div className="flex items-start gap-4 mb-4">
          <div className="flex-shrink-0 w-10 h-10 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold">
            5
          </div>
          <div className="flex-1">
            <h3 className="text-xl font-semibold text-zinc-900 mb-3">
              Update product-ids.json File
            </h3>
            <ol className="space-y-2 text-zinc-700 list-decimal list-inside">
              <li>Navigate to your project root folder</li>
              <li>Open <code className="bg-zinc-100 px-2 py-0.5 rounded text-sm">product-ids.json</code> file</li>
              <li>Replace the existing Product IDs with the ones you copied</li>
              <li>Save the file</li>
            </ol>
            <div className="mt-4 bg-zinc-50 rounded-lg p-4">
              <p className="text-sm text-zinc-600 mb-2">
                <strong>File Format:</strong>
              </p>
              <pre className="text-xs bg-white border rounded p-3 overflow-x-auto">
{`{
  "productIds": [
    "1060459d-bec9-48cf-a779-9f7ae5761337",
    "4df8b3f6-ea86-4b3f-9e0c-066f828f6d9a",
    "3db96861-236b-4dbf-81ca-10347412aa5e"
  ]
}`}</pre>
              <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded">
                <p className="text-xs text-amber-800">
                  <strong>⚠️ Important:</strong> Make sure to use proper JSON format with quotes and commas between IDs.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Step 6 */}
      <div className="mb-8 pb-8 border-b border-zinc-200">
        <div className="flex items-start gap-4 mb-4">
          <div className="flex-shrink-0 w-10 h-10 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold">
            6
          </div>
          <div className="flex-1">
            <h3 className="text-xl font-semibold text-zinc-900 mb-3">
              Fetch Products in Admin Panel
            </h3>
            <ol className="space-y-2 text-zinc-700 list-decimal list-inside">
              <li>Open the admin dashboard: <code className="bg-zinc-100 px-2 py-0.5 rounded text-sm">http://localhost:3000/admin</code></li>
              <li>Click on <strong>Treez Products</strong> in the sidebar</li>
              <li>The system will automatically fetch all products from the updated product-ids.json file</li>
              <li>Verify that all your products are displayed in the table</li>
            </ol>
            <div className="mt-4 border border-zinc-200 rounded-lg overflow-hidden">
              <img 
                src="/screenshots/admin-treez-products.png"
                alt="Treez Products page showing product list"
                className="w-full"
              />
              <div className="bg-zinc-50 px-4 py-2 text-sm text-zinc-600 border-t border-zinc-200">
                <strong>Screenshot 5:</strong> Admin dashboard showing fetched Treez products with all details
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Step 7 */}
      <div className="mb-8 pb-8 border-b border-zinc-200">
        <div className="flex items-start gap-4 mb-4">
          <div className="flex-shrink-0 w-10 h-10 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold">
            7
          </div>
          <div className="flex-1">
            <h3 className="text-xl font-semibold text-zinc-900 mb-3">
              Upload Products to Opticon
            </h3>
            <ol className="space-y-2 text-zinc-700 list-decimal list-inside">
              <li>In the sidebar, click on <strong>Product Mapping</strong></li>
              <li>Review all product data (price, barcode, name, etc.)</li>
              <li>Verify that all information is correct</li>
              <li>Click <strong>"Upload All to Opticon"</strong> button at the top</li>
              <li>Wait for all products to be uploaded (you'll see green checkmarks)</li>
            </ol>
            <div className="mt-4 border border-zinc-200 rounded-lg overflow-hidden">
              <img 
                src="/screenshots/product-mapping-upload.png"
                alt="Product Mapping page with Upload All button"
                className="w-full"
              />
              <div className="bg-zinc-50 px-4 py-2 text-sm text-zinc-600 border-t border-zinc-200">
                <strong>Screenshot 6:</strong> Product Mapping page with "Upload All to Opticon" button
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Step 8 */}
      <div className="mb-8 pb-8 border-b border-zinc-200">
        <div className="flex items-start gap-4 mb-4">
          <div className="flex-shrink-0 w-10 h-10 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold">
            8
          </div>
          <div className="flex-1">
            <h3 className="text-xl font-semibold text-zinc-900 mb-3">
              Sync Products to Database
            </h3>
            <ol className="space-y-2 text-zinc-700 list-decimal list-inside">
              <li>In the sidebar, go to <strong>Change Monitor</strong> tab</li>
              <li>Click <strong>"Sync Products from Treez"</strong> button</li>
              <li>This will upload product snapshots to Supabase database</li>
              <li>Wait for sync to complete</li>
              <li>You'll see all products listed in the "Monitored Products" table</li>
            </ol>
            <div className="mt-4 border border-zinc-200 rounded-lg overflow-hidden">
              <img 
                src="/screenshots/change-monitor-sync.png"
                alt="Change Monitor page with Sync button"
                className="w-full"
              />
              <div className="bg-zinc-50 px-4 py-2 text-sm text-zinc-600 border-t border-zinc-200">
                <strong>Screenshot 7:</strong> Change Monitor page with "Sync Products from Treez" button
              </div>
            </div>
            <div className="mt-4 bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-blue-800">
                <strong>ℹ️ Note:</strong> This step enables the real-time change detection system. Once synced, the system will automatically monitor these products for any changes.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Step 9 */}
      <div className="mb-8">
        <div className="flex items-start gap-4 mb-4">
          <div className="flex-shrink-0 w-10 h-10 rounded-full bg-green-600 text-white flex items-center justify-center font-bold">
            9
          </div>
          <div className="flex-1">
            <h3 className="text-xl font-semibold text-zinc-900 mb-3">
              Verify Products in Opticon
            </h3>
            <ol className="space-y-2 text-zinc-700 list-decimal list-inside">
              <li>Open Opticon EBS50 interface: <code className="bg-zinc-100 px-2 py-0.5 rounded text-sm">https://ebs50.local</code></li>
              <li>Navigate to the <strong>Products</strong> section</li>
              <li>Verify that all uploaded products appear in the list</li>
              <li>Check that <strong>Barcode column</strong> contains Treez Product IDs (UUIDs)</li>
              <li>Verify prices, names, and categories are correct</li>
            </ol>
            <div className="mt-4 border border-zinc-200 rounded-lg overflow-hidden">
              <img 
                src="/screenshots/opticon-products-list.png"
                alt="Opticon Products list showing synced products"
                className="w-full"
              />
              <div className="bg-zinc-50 px-4 py-2 text-sm text-zinc-600 border-t border-zinc-200">
                <strong>Screenshot 8:</strong> Opticon EBS50 Products list showing all synced products with Treez UUIDs in Barcode column
              </div>
            </div>
            <div className="mt-4 bg-green-50 border border-green-200 rounded-lg p-4">
              <p className="text-sm text-green-800">
                <strong>✅ Success Criteria:</strong> All products visible in Opticon with correct data. ProductId should be sequential (1, 2, 3...) and Barcode should contain Treez UUIDs.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Summary */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-blue-900 mb-3">
          🎉 Setup Complete!
        </h3>
        <p className="text-sm text-blue-800 mb-3">
          Once all steps are completed, your system is ready for real-time synchronization:
        </p>
        <ul className="space-y-2 text-sm text-blue-800 list-disc list-inside">
          <li>Products are now being monitored automatically</li>
          <li>Any price changes in Treez will sync to Opticon within 1-2 minutes</li>
          <li>Background monitoring runs continuously</li>
          <li>Check the Change Monitor page anytime to see sync status</li>
        </ul>
      </div>

      {/* Next Steps */}
      <div className="mt-8 bg-zinc-50 border border-zinc-200 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-zinc-900 mb-3">
          📌 Next Steps
        </h3>
        <ul className="space-y-2 text-sm text-zinc-700 list-disc list-inside">
          <li>Test the sync by changing a price in Treez and verifying it updates in Opticon</li>
          <li>Link ESL tags to products in the Opticon Base Station</li>
          <li>Add more products to product-ids.json as needed</li>
          <li>Monitor the Change Monitor page for real-time updates</li>
        </ul>
      </div>
    </div>
  );
}

function HowSyncWorksGuide() {
  return (
    <div className="bg-white rounded-lg border border-zinc-200 p-8">
      <h2 className="text-2xl font-bold text-zinc-900 mb-6">
        How Real-Time Sync Works
      </h2>

      <p className="text-zinc-700 mb-8">
        The Perfect Union ESL Sync System uses a three-layer architecture to keep your electronic shelf labels synchronized with Treez in real-time.
      </p>

      {/* Architecture Overview */}
      <div className="mb-12">
        <h3 className="text-xl font-semibold text-zinc-900 mb-4">
          System Architecture
        </h3>
        <div className="bg-zinc-50 rounded-lg p-6 border border-zinc-200">
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="flex-shrink-0 w-32 h-20 bg-green-100 border-2 border-green-600 rounded-lg flex items-center justify-center">
                <div className="text-center">
                  <div className="text-2xl mb-1">🏪</div>
                  <div className="text-xs font-semibold">Treez POS</div>
                </div>
              </div>
              <div className="flex-shrink-0 text-2xl">→</div>
              <div className="flex-shrink-0 w-32 h-20 bg-blue-100 border-2 border-blue-600 rounded-lg flex items-center justify-center">
                <div className="text-center">
                  <div className="text-2xl mb-1">💾</div>
                  <div className="text-xs font-semibold">Supabase</div>
                </div>
              </div>
              <div className="flex-shrink-0 text-2xl">→</div>
              <div className="flex-shrink-0 w-32 h-20 bg-purple-100 border-2 border-purple-600 rounded-lg flex items-center justify-center">
                <div className="text-center">
                  <div className="text-2xl mb-1">📱</div>
                  <div className="text-xs font-semibold">Opticon ESL</div>
                </div>
              </div>
            </div>
            <div className="text-sm text-zinc-600 text-center">
              Source of Truth → Middleware & Analytics → Display System
            </div>
          </div>
        </div>
      </div>

      {/* Layer 1: Treez */}
      <div className="mb-8 pb-8 border-b border-zinc-200">
        <div className="flex items-start gap-4">
          <div className="flex-shrink-0 w-12 h-12 rounded-lg bg-green-100 border-2 border-green-600 flex items-center justify-center text-2xl">
            🏪
          </div>
          <div className="flex-1">
            <h3 className="text-xl font-semibold text-zinc-900 mb-3">
              Layer 1: Treez POS (Source)
            </h3>
            <p className="text-zinc-700 mb-3">
              Treez is your single source of truth for all product data including prices, names, categories, and inventory.
            </p>
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <p className="text-sm font-semibold text-green-900 mb-2">What happens here:</p>
              <ul className="space-y-1 text-sm text-green-800 list-disc list-inside">
                <li>Store manager updates product price</li>
                <li>Changes product name or category</li>
                <li>Modifies product information</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Background Monitor */}
      <div className="mb-8 pb-8 border-b border-zinc-200">
        <div className="flex items-start gap-4">
          <div className="flex-shrink-0 w-12 h-12 rounded-lg bg-blue-100 border-2 border-blue-600 flex items-center justify-center text-2xl">
            🔍
          </div>
          <div className="flex-1">
            <h3 className="text-xl font-semibold text-zinc-900 mb-3">
              Background Monitor (Automatic Detection)
            </h3>
            <p className="text-zinc-700 mb-3">
              A background service runs continuously on your store computer, checking Treez every minute for changes.
            </p>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm font-semibold text-blue-900 mb-2">Detection Process:</p>
              <ul className="space-y-1 text-sm text-blue-800 list-disc list-inside">
                <li><strong>Every 1 minute:</strong> Fetches latest product data from Treez API</li>
                <li><strong>Compares:</strong> Checks current data against stored snapshots</li>
                <li><strong>Detects changes:</strong> Price, name, barcode, category, size updates</li>
                <li><strong>Works 24/7:</strong> No manual intervention needed</li>
              </ul>
              <div className="mt-3 p-3 bg-white rounded border">
                <p className="text-xs text-blue-900">
                  <strong>⏱️ Timeline:</strong> Changes detected within 60 seconds of being made in Treez
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Layer 2: Supabase */}
      <div className="mb-8 pb-8 border-b border-zinc-200">
        <div className="flex items-start gap-4">
          <div className="flex-shrink-0 w-12 h-12 rounded-lg bg-blue-100 border-2 border-blue-600 flex items-center justify-center text-2xl">
            💾
          </div>
          <div className="flex-1">
            <h3 className="text-xl font-semibold text-zinc-900 mb-3">
              Layer 2: Supabase Database (Middleware)
            </h3>
            <p className="text-zinc-700 mb-3">
              Acts as intelligent middleware between Treez and Opticon, providing change tracking, analytics, and audit trails.
            </p>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm font-semibold text-blue-900 mb-2">What gets stored:</p>
              <ul className="space-y-1 text-sm text-blue-800 list-disc list-inside">
                <li><strong>Product Snapshots:</strong> Current state of all monitored products</li>
                <li><strong>Change History:</strong> Complete log of all detected changes with timestamps</li>
                <li><strong>Sync Status:</strong> Tracks what's been pushed to Opticon</li>
                <li><strong>Audit Trail:</strong> When changes were detected and synced</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Auto-Sync to Opticon */}
      <div className="mb-8 pb-8 border-b border-zinc-200">
        <div className="flex items-start gap-4">
          <div className="flex-shrink-0 w-12 h-12 rounded-lg bg-purple-100 border-2 border-purple-600 flex items-center justify-center text-2xl">
            ⚡
          </div>
          <div className="flex-1">
            <h3 className="text-xl font-semibold text-zinc-900 mb-3">
              Automatic Sync to Opticon
            </h3>
            <p className="text-zinc-700 mb-3">
              When a change is detected, it's automatically pushed to Opticon within seconds - no manual action required.
            </p>
            <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
              <p className="text-sm font-semibold text-purple-900 mb-2">Sync Process:</p>
              <ul className="space-y-1 text-sm text-purple-800 list-disc list-inside">
                <li>Change logged to Supabase database</li>
                <li>System immediately pushes update to Opticon API</li>
                <li>Opticon identifies product by <strong>Barcode</strong> (Treez Product UUID)</li>
                <li>Updates price, name, or other changed fields</li>
                <li>Change marked as "Synced to Opticon" in database</li>
              </ul>
              <div className="mt-3 p-3 bg-white rounded border">
                <p className="text-xs text-purple-900">
                  <strong>⚡ Speed:</strong> Total sync time from Treez update to Opticon: 1-2 minutes
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Layer 3: Opticon */}
      <div className="mb-8 pb-8 border-b border-zinc-200">
        <div className="flex items-start gap-4">
          <div className="flex-shrink-0 w-12 h-12 rounded-lg bg-purple-100 border-2 border-purple-600 flex items-center justify-center text-2xl">
            📱
          </div>
          <div className="flex-1">
            <h3 className="text-xl font-semibold text-zinc-900 mb-3">
              Layer 3: Opticon ESL (Display System)
            </h3>
            <p className="text-zinc-700 mb-3">
              The Opticon EBS50 base station receives updates and pushes them to physical ESL tags on your shelves.
            </p>
            <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
              <p className="text-sm font-semibold text-purple-900 mb-2">Final Step:</p>
              <ul className="space-y-1 text-sm text-purple-800 list-disc list-inside">
                <li>Opticon receives product update via API</li>
                <li>Identifies which ESL tag is linked to the product</li>
                <li>Sends wireless update to ESL display</li>
                <li>Customer sees updated price on shelf within seconds</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Complete Flow Timeline */}
      <div className="mb-8 pb-8 border-b border-zinc-200">
        <h3 className="text-xl font-semibold text-zinc-900 mb-4">
          Complete Sync Timeline
        </h3>
        <div className="space-y-3">
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0 w-20 text-sm font-semibold text-zinc-600">00:00</div>
            <div className="flex-1 bg-green-50 border-l-4 border-green-600 rounded p-3">
              <p className="text-sm font-semibold text-green-900">Price Changed in Treez</p>
              <p className="text-xs text-green-700">Manager updates product from $25 to $30</p>
            </div>
          </div>

          <div className="flex items-start gap-4">
            <div className="flex-shrink-0 w-20 text-sm font-semibold text-zinc-600">00:30</div>
            <div className="flex-1 bg-blue-50 border-l-4 border-blue-600 rounded p-3">
              <p className="text-sm font-semibold text-blue-900">Background Monitor Checks</p>
              <p className="text-xs text-blue-700">Scheduled check runs (happens every 1 minute)</p>
            </div>
          </div>

          <div className="flex items-start gap-4">
            <div className="flex-shrink-0 w-20 text-sm font-semibold text-zinc-600">00:31</div>
            <div className="flex-1 bg-blue-50 border-l-4 border-blue-600 rounded p-3">
              <p className="text-sm font-semibold text-blue-900">Change Detected</p>
              <p className="text-xs text-blue-700">System identifies price change: $25 → $30</p>
            </div>
          </div>

          <div className="flex items-start gap-4">
            <div className="flex-shrink-0 w-20 text-sm font-semibold text-zinc-600">00:32</div>
            <div className="flex-1 bg-blue-50 border-l-4 border-blue-600 rounded p-3">
              <p className="text-sm font-semibold text-blue-900">Logged to Supabase</p>
              <p className="text-xs text-blue-700">Change recorded in database with timestamp</p>
            </div>
          </div>

          <div className="flex items-start gap-4">
            <div className="flex-shrink-0 w-20 text-sm font-semibold text-zinc-600">00:33</div>
            <div className="flex-1 bg-purple-50 border-l-4 border-purple-600 rounded p-3">
              <p className="text-sm font-semibold text-purple-900">Auto-Sync to Opticon</p>
              <p className="text-xs text-purple-700">System automatically pushes update to Opticon API</p>
            </div>
          </div>

          <div className="flex items-start gap-4">
            <div className="flex-shrink-0 w-20 text-sm font-semibold text-zinc-600">00:35</div>
            <div className="flex-1 bg-purple-50 border-l-4 border-purple-600 rounded p-3">
              <p className="text-sm font-semibold text-purple-900">Opticon Updates ESL</p>
              <p className="text-xs text-purple-700">Base station sends wireless update to shelf label</p>
            </div>
          </div>

          <div className="flex items-start gap-4">
            <div className="flex-shrink-0 w-20 text-sm font-semibold text-zinc-600">00:40</div>
            <div className="flex-1 bg-green-50 border-l-4 border-green-600 rounded p-3">
              <p className="text-sm font-semibold text-green-900">ESL Display Refreshes</p>
              <p className="text-xs text-green-700">Customer sees new price: $30 on shelf</p>
            </div>
          </div>
        </div>

        <div className="mt-4 bg-amber-50 border border-amber-200 rounded-lg p-4">
          <p className="text-sm text-amber-800">
            <strong>⏱️ Total Time:</strong> Approximately 40 seconds to 2 minutes from Treez change to ESL display update
          </p>
        </div>
      </div>

      {/* One-Way Sync */}
      <div className="mb-8 pb-8 border-b border-zinc-200">
        <h3 className="text-xl font-semibold text-zinc-900 mb-4">
          One-Way Synchronization
        </h3>
        <p className="text-zinc-700 mb-4">
          The system uses <strong>unidirectional sync</strong> (Treez → Opticon only) to maintain data integrity.
        </p>
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <p className="text-sm font-semibold text-green-900 mb-2">✅ Why One-Way?</p>
            <ul className="space-y-1 text-xs text-green-800 list-disc list-inside">
              <li>Treez remains single source of truth</li>
              <li>No data conflicts</li>
              <li>Simpler, more reliable</li>
              <li>Prevents accidental overwrites</li>
            </ul>
          </div>
          <div className="bg-zinc-50 border border-zinc-200 rounded-lg p-4">
            <p className="text-sm font-semibold text-zinc-900 mb-2">📋 What Gets Synced:</p>
            <ul className="space-y-1 text-xs text-zinc-700 list-disc list-inside">
              <li>Product prices (Standard & Sell)</li>
              <li>Product names/descriptions</li>
              <li>Categories/groups</li>
              <li>Size and unit information</li>
              <li>Barcodes</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Product Identification */}
      <div className="mb-8 pb-8 border-b border-zinc-200">
        <h3 className="text-xl font-semibold text-zinc-900 mb-4">
          Product Identification System
        </h3>
        <p className="text-zinc-700 mb-4">
          Understanding how products are matched between Treez and Opticon:
        </p>
        <div className="bg-zinc-50 border border-zinc-200 rounded-lg p-4">
          <div className="space-y-3">
            <div>
              <p className="text-sm font-semibold text-zinc-900">Treez Product ID (UUID):</p>
              <code className="text-xs bg-white px-2 py-1 rounded border">1060459d-bec9-48cf-a779-9f7ae5761337</code>
            </div>
            <div className="text-center text-zinc-400">↓ Mapped as ↓</div>
            <div>
              <p className="text-sm font-semibold text-zinc-900">Opticon Barcode Field:</p>
              <code className="text-xs bg-white px-2 py-1 rounded border">1060459d-bec9-48cf-a779-9f7ae5761337</code>
            </div>
            <div className="text-center text-zinc-400">+</div>
            <div>
              <p className="text-sm font-semibold text-zinc-900">Opticon ProductId:</p>
              <code className="text-xs bg-white px-2 py-1 rounded border">1, 2, 3, 4... (sequential)</code>
            </div>
          </div>
          <div className="mt-4 p-3 bg-blue-50 rounded">
            <p className="text-xs text-blue-900">
              <strong>💡 Key Point:</strong> When syncing, the system finds products in Opticon by matching the <strong>Barcode field</strong> (which contains the Treez UUID), not by ProductId.
            </p>
          </div>
        </div>
      </div>

      {/* Monitoring Dashboard */}
      <div className="mb-8">
        <h3 className="text-xl font-semibold text-zinc-900 mb-4">
          Real-Time Monitoring Dashboard
        </h3>
        <p className="text-zinc-700 mb-4">
          The Change Monitor page provides complete visibility into the sync process:
        </p>
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white border border-zinc-200 rounded-lg p-4">
            <div className="text-2xl mb-2">📊</div>
            <p className="text-sm font-semibold text-zinc-900 mb-2">Statistics Dashboard</p>
            <ul className="space-y-1 text-xs text-zinc-700 list-disc list-inside">
              <li>Total products monitored</li>
              <li>Total changes detected</li>
              <li>Synced to Supabase count</li>
              <li>Pending on Opticon count</li>
            </ul>
          </div>

          <div className="bg-white border border-zinc-200 rounded-lg p-4">
            <div className="text-2xl mb-2">📝</div>
            <p className="text-sm font-semibold text-zinc-900 mb-2">Change History</p>
            <ul className="space-y-1 text-xs text-zinc-700 list-disc list-inside">
              <li>Last 50 changes shown</li>
              <li>Color-coded by type (price, name, etc.)</li>
              <li>Old value → New value display</li>
              <li>Sync status badges</li>
            </ul>
          </div>

          <div className="bg-white border border-zinc-200 rounded-lg p-4">
            <div className="text-2xl mb-2">🔔</div>
            <p className="text-sm font-semibold text-zinc-900 mb-2">Real-Time Updates</p>
            <ul className="space-y-1 text-xs text-zinc-700 list-disc list-inside">
              <li>Page updates automatically</li>
              <li>No refresh needed</li>
              <li>See changes as they happen</li>
              <li>Background indicator shows status</li>
            </ul>
          </div>

          <div className="bg-white border border-zinc-200 rounded-lg p-4">
            <div className="text-2xl mb-2">⚙️</div>
            <p className="text-sm font-semibold text-zinc-900 mb-2">Manual Controls</p>
            <ul className="space-y-1 text-xs text-zinc-700 list-disc list-inside">
              <li>"Check for Changes" button</li>
              <li>"Sync to Opticon" per change</li>
              <li>Auto-refresh toggle (optional)</li>
              <li>Configurable intervals</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Summary */}
      <div className="bg-gradient-to-br from-blue-50 to-purple-50 border border-blue-200 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-zinc-900 mb-3">
          🎯 In Summary
        </h3>
        <div className="space-y-2 text-sm text-zinc-700">
          <p>
            <strong>1. Automatic:</strong> No manual work required once set up
          </p>
          <p>
            <strong>2. Fast:</strong> Changes reflect within 1-2 minutes
          </p>
          <p>
            <strong>3. Reliable:</strong> Background monitoring ensures nothing is missed
          </p>
          <p>
            <strong>4. Transparent:</strong> Complete visibility through monitoring dashboard
          </p>
          <p>
            <strong>5. Auditable:</strong> Full history of all changes and syncs
          </p>
        </div>
      </div>
    </div>
  );
}

function PlaceholderContent({ title }: { title: string }) {
  return (
    <div className="bg-white rounded-lg border border-zinc-200 p-12 text-center">
      <div className="text-6xl mb-4">📝</div>
      <h2 className="text-xl font-semibold text-zinc-900 mb-2">
        {title}
      </h2>
      <p className="text-zinc-600">
        Content coming soon
      </p>
    </div>
  );
}

