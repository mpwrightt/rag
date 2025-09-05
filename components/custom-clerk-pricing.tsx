'use client'
import { PricingTable } from "@clerk/nextjs";
import { dark } from '@clerk/themes'
import { useTheme } from "next-themes"

export default function CustomClerkPricing() {
    const { theme } = useTheme()
    return (
        <>
            <PricingTable
                appearance={{
                    baseTheme: theme === "dark" ? dark : undefined,
                    elements: {
                        pricingTableCardTitle: { // title
                            fontSize: 20,
                            fontWeight: 400,
                        },
                        pricingTableCardDescription: { // description
                            fontSize: 14
                        },
                        pricingTableCardFee: { // price
                            fontSize: 36,
                            fontWeight: 800,  
                        },
                        pricingTable: {
                            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                            gap: '1.5rem',
                            padding: '0 1rem',
                            '@media (max-width: 768px)': {
                                gridTemplateColumns: '1fr',
                                gap: '1rem',
                                padding: '0 0.5rem',
                            },
                            '@media (max-width: 480px)': {
                                gridTemplateColumns: '1fr',
                                gap: '0.75rem',
                                padding: '0',
                            }
                        },
                        pricingTableCard: {
                            minHeight: '400px',
                            '@media (max-width: 768px)': {
                                minHeight: '350px',
                                padding: '1.5rem',
                            },
                            '@media (max-width: 480px)': {
                                minHeight: '320px',
                                padding: '1rem',
                            }
                        },
                        pricingTableCardButton: {
                            minHeight: '44px',
                            fontSize: '16px',
                            '@media (max-width: 768px)': {
                                minHeight: '48px',
                                fontSize: '16px',
                            }
                        },
                    },
                }}
                
            />
        </>
    )
}