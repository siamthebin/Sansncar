/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { MapPin, ArrowRight, User, LogIn, Shield, Clock, CreditCard, HelpCircle, Package, Car, Bike, Truck, Plane, Building2, X } from 'lucide-react';
import Profile from './components/Profile';
import AdminDashboard from './components/AdminDashboard';
import PaymentForm from './components/PaymentForm';
import Map from './components/Map';
import { auth, googleProvider, db } from './firebase';
import { LoginWithSanscounts } from './components/LoginWithSanscounts';
import { signInWithPopup, signInWithCustomToken, onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { collection, onSnapshot, getDocs, query, limit, where, addDoc, doc, getDoc, orderBy, updateDoc } from 'firebase/firestore';
import { translations } from './translations';

interface PromoBanner {
  id: string;
  text: string;
  imageUrl?: string;
  link?: string;
}

interface Driver {
  id?: string;
  name: string;
  vehicle: string;
  email?: string;
  photo: string;
  available?: boolean;
  rating?: number;
}

export default function App() {
  const [pickup, setPickup] = useState('');
  const [destination, setDestination] = useState('');
  const [view, setView] = useState<'booking' | 'profile' | 'admin'>('booking');
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [banners, setBanners] = useState<PromoBanner[]>([]);
  const [selectedVehicle, setSelectedVehicle] = useState<string | null>(null);
  const [isBooked, setIsBooked] = useState(false);
  const [bookingId, setBookingId] = useState<string | null>(null);
  const [driver, setDriver] = useState<Driver | null>(null);
  const [availableDrivers, setAvailableDrivers] = useState<Driver[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPayment, setShowPayment] = useState(false);
  const [userLocation, setUserLocation] = useState<[number, number]>([0, 0]);
  const [driverLocation, setDriverLocation] = useState<[number, number]>([0, 0]);
  const [language, setLanguage] = useState('English');
  const [showLoginModal, setShowLoginModal] = useState(false);
  const t = translations[language] || translations['English'];

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
        if (userDoc.exists()) {
          setLanguage(userDoc.data().language || 'English');
        }
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const q = query(collection(db, 'promoBanners'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (snapshot.empty) {
        // Default banners if none exist in Firestore
        setBanners([
          {
            id: '1',
            text: 'প্রথম রাইডে ৫০% ছাড়! কোড: SANS50',
            imageUrl: 'https://picsum.photos/seed/ride1/800/400'
          },
          {
            id: '2',
            text: 'বন্ধুকে রেফার করুন আর পান ১০০ টাকা বোনাস',
            imageUrl: 'https://picsum.photos/seed/refer/800/400'
          },
          {
            id: '3',
            text: 'নিরাপদ এবং আরামদায়ক যাত্রার জন্য Sansncar বেছে নিন',
            imageUrl: 'https://picsum.photos/seed/safety/800/400'
          }
        ]);
      } else {
        const bannerData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PromoBanner));
        setBanners(bannerData);
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!bookingId) return;

    const unsubscribe = onSnapshot(doc(db, 'bookings', bookingId), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.driverLocation) {
          setDriverLocation([data.driverLocation.lat, data.driverLocation.lng]);
        }
      }
    });

    // Simulate driver movement towards user
    const interval = setInterval(async () => {
      try {
        const currentDoc = await getDoc(doc(db, 'bookings', bookingId));
        if (currentDoc.exists()) {
          const data = currentDoc.data();
          if (data.driverLocation && data.userLocation) {
            const dLat = data.driverLocation.lat;
            const dLng = data.driverLocation.lng;
            const uLat = data.userLocation.lat;
            const uLng = data.userLocation.lng;
            
            // Move 10% closer to user every 3 seconds
            const newLat = dLat + (uLat - dLat) * 0.1;
            const newLng = dLng + (uLng - dLng) * 0.1;
            
            await updateDoc(doc(db, 'bookings', bookingId), {
              driverLocation: { lat: newLat, lng: newLng }
            });
          }
        }
      } catch (err) {
        console.error("Error updating driver location:", err);
      }
    }, 3000);

    return () => {
      unsubscribe();
      clearInterval(interval);
    };
  }, [bookingId]);

  const handleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
      setShowLoginModal(false);
    } catch (error) {
      console.error('Login failed', error);
      setError('Google login failed.');
    }
  };

  const handleSanscountsSuccess = async (userData: any) => {
    const token = userData?.token || userData?.access_token || userData?.customToken || userData?.idToken;
    const code = userData?.code;

    if (token) {
      try {
        await signInWithCustomToken(auth, token);
        setShowLoginModal(false);
      } catch (error: any) {
        console.error('Sanscounts login failed:', error);
        setError(`Failed to sign in with token: ${error.message}`);
      }
    } else if (code) {
      try {
        // Try to exchange code for token
        const tokenUrl = 'https://ais-dev-nzkcf6uurov3zlnhgpfwpv-488568450855.asia-east1.run.app/oauth/token';
        const response = await fetch(tokenUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            client_id: 'sansncar-client-id',
            code: code,
            grant_type: 'authorization_code',
            redirect_uri: `${window.location.origin}/auth/callback`
          })
        });
        
        if (!response.ok) {
          const errText = await response.text();
          throw new Error(`Token exchange failed: ${response.status} ${errText}`);
        }

        const data = await response.json();
        const exchangedToken = data.token || data.access_token || data.customToken || data.idToken;
        
        if (exchangedToken) {
          await signInWithCustomToken(auth, exchangedToken);
          setShowLoginModal(false);
        } else {
          setError(`Code exchange succeeded but no token returned. Payload: ${JSON.stringify(data)}`);
        }
      } catch (error: any) {
        console.error('Code exchange failed:', error);
        setError(`Failed to exchange code. Error: ${error.message}. Payload: ${JSON.stringify(userData)}`);
      }
    } else {
      console.warn('No token or code received from Sanscounts', userData);
      setError(`No token or code received. Payload: ${JSON.stringify(userData)}`);
    }
  };

  const handleSearchRides = async () => {
    setError(null);
    if (!user) {
      setError(t.pleaseLogin);
      return;
    }
    if (!pickup || !destination) {
      setError(t.enterLocations);
      return;
    }
    
    setIsSearching(true);
    setHasSearched(false);
    
    try {
      let q;
      if (selectedVehicle) {
        q = query(collection(db, 'drivers'), where('available', '==', true), where('vehicle', '==', selectedVehicle));
      } else {
        q = query(collection(db, 'drivers'), where('available', '==', true));
      }
      
      const snapshot = await getDocs(q);
      const driversData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Driver));
      
      if (driversData.length > 0) {
        setAvailableDrivers(driversData);
      } else {
        // Fallback mock drivers for demo purposes
        setAvailableDrivers([
          {
            id: 'mock-1',
            name: 'Rahim Ahmed',
            vehicle: selectedVehicle || 'Car',
            photo: 'https://picsum.photos/seed/driver1/200',
            available: true,
            rating: 4.8
          },
          {
            id: 'mock-2',
            name: 'Karim Hossain',
            vehicle: selectedVehicle || 'Bike',
            photo: 'https://picsum.photos/seed/driver2/200',
            available: true,
            rating: 4.5
          }
        ]);
      }
      setHasSearched(true);
    } catch (err) {
      console.error('Search error:', err);
      setError(t.somethingWrong);
    } finally {
      setIsSearching(false);
    }
  };

  if (view === 'profile') {
    return <Profile onBack={() => setView('booking')} onAdmin={() => setView('admin')} user={user} onLanguageChange={(lang) => setLanguage(lang)} />;
  }

  if (view === 'admin') {
    return <AdminDashboard onBack={() => setView('profile')} />;
  }

  return (
    <div className="min-h-screen bg-black text-white p-6 flex flex-col">
      <header className="flex justify-between items-center mb-10">
        <h1 className="text-2xl font-bold tracking-tighter">Sansncar</h1>
        {user ? (
          <div className="flex items-center gap-4">
            <span className="text-xs text-zinc-500 font-medium">{language}</span>
            <button 
              onClick={() => setView('profile')}
              className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center hover:bg-zinc-700"
            >
              <User size={20} />
            </button>
          </div>
        ) : (
          <button 
            onClick={() => setShowLoginModal(true)}
            className="flex items-center gap-2 bg-zinc-800 px-4 py-2 rounded-full hover:bg-zinc-700 text-sm font-bold"
          >
            <LogIn size={16} />
            {t.login}
          </button>
        )}
      </header>

      <main className="flex-grow space-y-6">
        {error && (
          <div className="bg-red-500/10 border border-red-500/50 text-red-500 p-4 rounded-2xl text-sm text-center">
            {error}
          </div>
        )}
        {!isBooked ? (
          <>
            {showPayment ? (
              <PaymentForm amount={1000} onSuccess={async () => {
                navigator.geolocation.getCurrentPosition(async (position) => {
                  const uLat = position.coords.latitude;
                  const uLng = position.coords.longitude;
                  // Start driver slightly away
                  const dLat = uLat + 0.01;
                  const dLng = uLng + 0.01;

                  try {
                    const docRef = await addDoc(collection(db, 'bookings'), {
                      userId: user?.uid,
                      pickup,
                      destination,
                      vehicle: selectedVehicle,
                      driverName: driver?.name,
                      timestamp: new Date(),
                      amount: 1000,
                      userLocation: { lat: uLat, lng: uLng },
                      driverLocation: { lat: dLat, lng: dLng }
                    });
                    setBookingId(docRef.id);
                    setUserLocation([uLat, uLng]);
                    setDriverLocation([dLat, dLng]);
                    setIsBooked(true); 
                    setShowPayment(false); 
                  } catch (err) {
                    console.error("Error creating booking:", err);
                    setError("Failed to book ride.");
                  }
                }, (error) => {
                  console.error("Geolocation error", error);
                  setError("Could not get your location.");
                });
              }} />
            ) : (
              <>
                <div className="bg-zinc-900 p-6 rounded-2xl border border-zinc-800 space-y-4">
                  <div className="flex items-center gap-3 border-b border-zinc-800 pb-4">
                    <MapPin className="text-zinc-500" size={20} />
                    <input
                      type="text"
                      placeholder={t.pickup}
                      className="bg-transparent w-full focus:outline-none"
                      value={pickup}
                      onChange={(e) => setPickup(e.target.value)}
                    />
                  </div>
                  <div className="flex items-center gap-3">
                    <ArrowRight className="text-zinc-500" size={20} />
                    <input
                      type="text"
                      placeholder={t.whereTo}
                      className="bg-transparent w-full focus:outline-none"
                      value={destination}
                      onChange={(e) => setDestination(e.target.value)}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  {(['Rickshaw', 'Car', 'Bike'] as const).map((vehicle) => (
                    <button
                      key={vehicle}
                      onClick={() => setSelectedVehicle(vehicle)}
                      className={`p-4 rounded-2xl border flex flex-col items-center gap-2 transition-all ${
                        selectedVehicle === vehicle
                          ? 'bg-white text-black border-white'
                          : 'bg-zinc-900 text-white border-zinc-800 hover:border-zinc-600'
                      }`}
                    >
                      <span className="text-3xl">
                        {vehicle === 'Rickshaw' ? '🛺' : vehicle === 'Car' ? '🚙' : '🏍️'}
                      </span>
                      <span className="text-sm font-medium">{vehicle}</span>
                    </button>
                  ))}
                </div>

                {hasSearched && (
                  <div className="space-y-4 mt-6">
                    <h3 className="text-lg font-bold px-1">{t.availableRides}</h3>
                    {availableDrivers.length > 0 ? (
                      <div className="grid grid-cols-1 gap-4">
                        {availableDrivers.map(d => (
                          <div key={d.id} className="bg-zinc-900 p-4 rounded-2xl border border-zinc-800 flex items-center justify-between">
                            <div className="flex items-center gap-4">
                              <img src={d.photo} alt={d.name} className="w-12 h-12 rounded-full object-cover" referrerPolicy="no-referrer" />
                              <div>
                                <p className="font-bold">{d.name}</p>
                                <p className="text-sm text-zinc-400">{d.vehicle} • ⭐ {d.rating || '4.5'}</p>
                              </div>
                            </div>
                            <button 
                              onClick={() => {
                                setDriver(d);
                                setShowPayment(true);
                              }}
                              className="bg-white text-black px-4 py-2 rounded-xl font-bold text-sm"
                            >
                              {t.bookRide}
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-zinc-400 text-center py-4">{t.noRidesFound}</p>
                    )}
                  </div>
                )}
              </>
            )}
          </>
        ) : (
          <div className="bg-zinc-900 p-6 rounded-2xl border border-zinc-800 space-y-4 text-center">
            <h2 className="text-2xl font-bold">{t.rideBooked}</h2>
            {userLocation[0] !== 0 && (
              <Map center={userLocation} driverLocation={driverLocation} />
            )}
            {driver && (
              <div className="space-y-2">
                <img src={driver.photo} alt={driver.name} className="w-24 h-24 rounded-full mx-auto" referrerPolicy="no-referrer" />
                <p className="font-bold text-lg">{driver.name}</p>
                <p className="text-zinc-400">{driver.vehicle}</p>
              </div>
            )}
          </div>
        )}
        {!isBooked && !showPayment && (
          <button 
            onClick={handleSearchRides} 
            disabled={isSearching}
            className="w-full bg-white text-black font-bold py-4 rounded-2xl my-2 disabled:opacity-70"
          >
            {isSearching ? '...' : t.searchRides}
          </button>
        )}

        {banners.length > 0 && (
          <div className="flex gap-4 overflow-x-auto pb-4 no-scrollbar snap-x">
            {banners.map(banner => (
              <div 
                key={banner.id} 
                className="min-w-[280px] bg-zinc-800 rounded-2xl border border-zinc-700 overflow-hidden snap-center"
              >
                {banner.imageUrl && (
                  <img 
                    src={banner.imageUrl} 
                    alt="" 
                    className="w-full h-32 object-cover" 
                    referrerPolicy="no-referrer" 
                  />
                )}
              </div>
            ))}
          </div>
        )}

        {/* New Sections for Scrollability */}
        <section className="space-y-4">
          <h3 className="text-lg font-bold px-1">{t.airFlightsBooking}</h3>
          <div className="grid grid-cols-2 gap-4">
            <button 
              onClick={() => {
                setSelectedVehicle('Airplane');
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              className={`p-4 rounded-2xl border flex flex-col gap-3 text-left transition-all ${
                selectedVehicle === 'Airplane' ? 'bg-zinc-800 border-white' : 'bg-zinc-900 border-zinc-800 hover:border-zinc-600'
              }`}
            >
              <div className="w-10 h-10 bg-blue-500/20 rounded-xl flex items-center justify-center text-blue-500">
                <Plane size={20} />
              </div>
              <div>
                <p className="font-bold text-sm">{t.airplane}</p>
                <p className="text-xs text-zinc-500">{t.airplaneDesc}</p>
              </div>
            </button>

            <button 
              onClick={() => {
                setSelectedVehicle('Intercity');
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              className={`p-4 rounded-2xl border flex flex-col gap-3 text-left transition-all ${
                selectedVehicle === 'Intercity' ? 'bg-zinc-800 border-white' : 'bg-zinc-900 border-zinc-800 hover:border-zinc-600'
              }`}
            >
              <div className="w-10 h-10 bg-purple-500/20 rounded-xl flex items-center justify-center text-purple-500">
                <Building2 size={20} />
              </div>
              <div>
                <p className="font-bold text-sm">{t.intercity}</p>
                <p className="text-xs text-zinc-500">{t.intercityDesc}</p>
              </div>
            </button>
          </div>
        </section>

        <section className="bg-zinc-900 p-6 rounded-2xl border border-zinc-800 space-y-4">
          <div className="flex items-center gap-3 text-emerald-500">
            <Shield size={24} />
            <h3 className="font-bold">{t.safetyTitle}</h3>
          </div>
          <p className="text-sm text-zinc-400 leading-relaxed">
            {t.safetyDesc}
          </p>
          <div className="grid grid-cols-2 gap-4 pt-2">
            <div className="flex items-center gap-2 text-xs text-zinc-500">
              <Clock size={14} />
              <span>{t.support}</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-zinc-500">
              <CreditCard size={14} />
              <span>{t.cashless}</span>
            </div>
          </div>
        </section>

      </main>

      {showLoginModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-8 w-full max-w-md relative">
            <button 
              onClick={() => setShowLoginModal(false)}
              className="absolute top-4 right-4 text-zinc-400 hover:text-white"
            >
              <X size={24} />
            </button>
            <h2 className="text-2xl font-bold mb-6 text-center">Welcome to Sansncar</h2>
            <div className="space-y-4">
              <LoginWithSanscounts onLoginSuccess={handleSanscountsSuccess} />
              <button 
                onClick={handleLogin}
                className="w-full py-3 px-4 bg-white hover:bg-zinc-100 text-black font-bold rounded-full transition-all flex items-center justify-center gap-3 shadow-sm border border-zinc-200"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                  <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                </svg>
                Sign in with Google
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
