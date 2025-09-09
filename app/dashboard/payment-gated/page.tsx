// Demo mode: paywall removed


function FeaturesCard() {
  return (
    <div className="px-4 sm:px-4 lg:px-6">
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl sm:text-2xl font-bold">Advanced features</h1>
        </div>
        <div className="rounded-lg border bg-card p-4 sm:p-6">
          <h2 className="text-base sm:text-lg font-semibold mb-2 sm:mb-4">Page with advanced features</h2>
            <p className="text-muted-foreground text-sm sm:text-base">
              Access to advanced features.
            </p>
          </div>
        </div>
      </div>
    )
}


export default function TeamPage() {
  return (
      <FeaturesCard />
  )
} 