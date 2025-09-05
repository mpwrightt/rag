import SplashCursor from '@/components/react-bits/splash-cursor'
import Link from 'next/link'
import { IconArrowRight } from '@tabler/icons-react'


export default function NotFoundPage() {
    return (
        <section className="h-screen w-screen flex flex-col items-center justify-center bg-black px-4">
            <h1 className="text-4xl sm:text-6xl font-black tracking-tight text-white text-center">Page not found</h1>
            <Link href="/" className="mt-8 sm:mt-16">
                <div className="bg-white text-black text-base sm:text-xl font-medium flex items-center justify-center px-4 sm:px-6 py-2.5 sm:py-3 rounded-full hover:bg-gray-100 transition-colors touch-manipulation min-h-[44px]">
                    <span>Home</span>
                    <IconArrowRight className="ml-2 w-4 h-4 sm:w-5 sm:h-5" />
                </div>
            </Link>
            <SplashCursor />
        </section>
    )
}