import { useEffect, useState } from "react";

export interface Account {
    _id: string;
    type: string;
    nickname: string;
    rewards: number;
    balance: number;
    account_number: string;
    customer_id: string;
}

export interface Transaction {
    _id: string;
    type: string;
    transaction_date: string;
    status: string;
    payer_id: string;
    medium: string;
    amount: number;
    description: string;
}

export interface CustomerSnapshot {
    customer_id: string;
    accounts: {
        account: Account | { error: string };
        customer: any;
        bills: any[];
        deposits: any[];
        loans: any[];
        purchases: any[]; // These might map to Transaction if structure matches
        transfers: any[];
        withdrawals: any[];
    }[];
}

export function useCustomerSnapshot(customerId: string) {
    const [data, setData] = useState<CustomerSnapshot | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const refresh = () => {
        setLoading(true);
        const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL ?? "http://localhost:5001";
        fetch(`${API_BASE_URL}/api/capitalone/customer/${customerId}/snapshot`)
            .then((r) => {
                if (!r.ok) throw new Error(`HTTP error! status: ${r.status}`);
                return r.json();
            })
            .then((j) => {
                setData(j);
                setError(null);
            })
            .catch((e) => {
                console.error("Snapshot error:", e);
                setError(String(e));
            })
            .finally(() => {
                setLoading(false);
            });
    };

    useEffect(() => {
        if (!customerId) return;
        refresh();
    }, [customerId]);

    return { data, loading, error, refresh };
}
