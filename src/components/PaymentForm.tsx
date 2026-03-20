import React, { useState } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { CardElement, useStripe, useElements, Elements } from '@stripe/react-stripe-js';

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLIC_KEY || "");

interface PaymentFormProps {
  amount: number;
  onSuccess: () => void;
}

const PaymentFormContent = ({ amount, onSuccess }: PaymentFormProps) => {
  const stripe = useStripe();
  const elements = useElements();
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!stripe || !elements) return;

    const cardElement = elements.getElement('card');
    if (!cardElement) return;

    const response = await fetch('/api/create-payment-intent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount }),
    });
    const { clientSecret } = await response.json();

    const result = await stripe.confirmCardPayment(clientSecret, {
      payment_method: { card: cardElement },
    });

    if (result.error) {
      setError(result.error.message || 'Payment failed');
    } else {
      onSuccess();
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 bg-zinc-900 p-6 rounded-2xl border border-zinc-800">
      <CardElement className="p-3 bg-zinc-800 rounded-lg text-white" />
      <button type="submit" disabled={!stripe} className="w-full bg-white text-black font-bold py-3 rounded-lg">
        Pay ${amount / 100}
      </button>
      {error && <p className="text-red-500 text-sm">{error}</p>}
    </form>
  );
};

export default function PaymentForm({ amount, onSuccess }: PaymentFormProps) {
  return (
    <Elements stripe={stripePromise}>
      <PaymentFormContent amount={amount} onSuccess={onSuccess} />
    </Elements>
  );
}
