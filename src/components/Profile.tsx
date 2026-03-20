import { useState, useEffect } from 'react';
import { User, Mail, Phone, ArrowLeft, Save, LogOut, ArrowRight, Clock, Globe } from 'lucide-react';
import { db, auth } from '../firebase';
import { doc, getDoc, setDoc, query, collection, where, onSnapshot, orderBy } from 'firebase/firestore';
import { User as FirebaseUser, signOut } from 'firebase/auth';

import { translations } from '../translations';

interface ProfileProps {
  onBack: () => void;
  onAdmin: () => void;
  user: FirebaseUser | null;
  onLanguageChange: (lang: string) => void;
}

interface Booking {
  id: string;
  pickup: string;
  destination: string;
  vehicle: string;
  driverName: string;
  timestamp: any;
  amount: number;
}

export default function Profile({ onBack, onAdmin, user, onLanguageChange }: ProfileProps) {
  const [name, setName] = useState(user?.displayName || '');
  const [email, setEmail] = useState(user?.email || '');
  const [phone, setPhone] = useState('');
  const [language, setLanguage] = useState('English');
  const [isEditing, setIsEditing] = useState(false);
  const [bookings, setBookings] = useState<Booking[]>([]);

  const t = translations[language] || translations['English'];

  const isAdmin = user?.email === 'sloudsan@gmail.com';

  useEffect(() => {
    if (user) {
      const fetchProfile = async () => {
        const docRef = doc(db, 'users', user.uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          setName(data.name || user.displayName || '');
          setEmail(data.email || user.email || '');
          setPhone(data.phone || '');
          setLanguage(data.language || 'English');
        }
      };
      fetchProfile();

      const q = query(
        collection(db, 'bookings'),
        where('userId', '==', user.uid),
        orderBy('timestamp', 'desc')
      );
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const bookingData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Booking));
        setBookings(bookingData);
      });
      return () => unsubscribe();
    }
  }, [user]);

  const saveProfile = async () => {
    if (user) {
      const docRef = doc(db, 'users', user.uid);
      await setDoc(docRef, { uid: user.uid, name, email, phone, language }, { merge: true });
      onLanguageChange(language);
      setIsEditing(false);
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
    onBack();
  };

  return (
    <div className="min-h-screen bg-black text-white p-6 flex flex-col">
      <header className="flex justify-between items-center mb-10">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="p-2 rounded-full hover:bg-zinc-800">
            <ArrowLeft size={24} />
          </button>
          <h1 className="text-2xl font-bold tracking-tighter">{t.profile}</h1>
        </div>
        <button onClick={handleLogout} className="p-2 rounded-full hover:bg-zinc-800 text-red-500">
          <LogOut size={24} />
        </button>
      </header>

      <main className="flex-grow space-y-6">
        <div className="flex flex-col items-center mb-8">
          <div className="w-24 h-24 rounded-full bg-zinc-800 flex items-center justify-center mb-4">
            <User size={48} className="text-zinc-500" />
          </div>
          <button 
            onClick={() => setIsEditing(!isEditing)}
            className="text-sm text-zinc-400 hover:text-white"
          >
            {isEditing ? t.cancel : t.editProfile}
          </button>
        </div>

        <div className="bg-zinc-900 p-6 rounded-2xl border border-zinc-800 space-y-4">
          {/* ... existing fields ... */}
          <div className="flex items-center gap-3 border-b border-zinc-800 pb-4">
            <User className="text-zinc-500" size={20} />
            <input
              type="text"
              className="bg-transparent w-full focus:outline-none"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={!isEditing}
            />
          </div>
          <div className="flex items-center gap-3 border-b border-zinc-800 pb-4">
            <Mail className="text-zinc-500" size={20} />
            <input
              type="email"
              className="bg-transparent w-full focus:outline-none"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={!isEditing}
            />
          </div>
          <div className="flex items-center gap-3 border-b border-zinc-800 pb-4">
            <Phone className="text-zinc-500" size={20} />
            <input
              type="tel"
              className="bg-transparent w-full focus:outline-none"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              disabled={!isEditing}
            />
          </div>
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-3 text-zinc-500">
              <Globe size={20} />
              <span className="text-sm">{t.selectLanguage}</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {[
                { name: 'Portuguese', flag: '🇵🇹' },
                { name: 'English', flag: '🇺🇸' },
                { name: 'Bangla', flag: '🇧🇩' },
                { name: 'Arabic', flag: '🇸🇦' },
                { name: 'Chinese', flag: '🇨🇳' },
                { name: 'Japanese', flag: '🇯🇵' },
                { name: 'Korean', flag: '🇰🇷' }
              ].map((lang) => (
                <button
                  key={lang.name}
                  disabled={!isEditing}
                  onClick={() => setLanguage(lang.name)}
                  className={`p-3 rounded-xl border text-sm flex items-center justify-between transition-all ${
                    language === lang.name
                      ? 'bg-white text-black border-white'
                      : 'bg-zinc-800 text-white border-zinc-700 hover:border-zinc-600'
                  } ${!isEditing && 'opacity-50 cursor-not-allowed'}`}
                >
                  <span>{lang.name}</span>
                  <span>{lang.flag}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {isAdmin && (
          <button 
            onClick={onAdmin}
            className="w-full bg-zinc-800 p-4 rounded-2xl border border-zinc-700 flex items-center justify-between hover:bg-zinc-700"
          >
            <span className="font-bold">{t.admin}</span>
            <ArrowRight size={20} />
          </button>
        )}

        <div className="space-y-4">
          <h2 className="text-xl font-bold">{t.rideHistory}</h2>
          {bookings.length === 0 ? (
            <p className="text-zinc-500 text-sm">{t.noRides}</p>
          ) : (
            bookings.map(booking => (
              <div key={booking.id} className="bg-zinc-900 p-4 rounded-2xl border border-zinc-800 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="bg-zinc-800 p-2 rounded-full">
                    <Clock size={20} className="text-zinc-400" />
                  </div>
                  <div>
                    <p className="font-bold">{booking.pickup} to {booking.destination}</p>
                    <p className="text-xs text-zinc-400">{new Date(booking.timestamp.seconds * 1000).toLocaleDateString()}</p>
                  </div>
                </div>
                <p className="font-bold">${booking.amount / 100}</p>
              </div>
            ))
          )}
        </div>
      </main>

      {isEditing && (
        <footer className="mt-auto">
          <button 
            onClick={saveProfile}
            className="w-full bg-white text-black font-bold py-4 rounded-2xl flex items-center justify-center gap-2"
          >
            <Save size={20} />
            {t.saveChanges}
          </button>
        </footer>
      )}
    </div>
  );
}
