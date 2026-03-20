import { useState, useEffect, ChangeEvent } from 'react';
import { Plus, Trash2, ArrowLeft } from 'lucide-react';
import { db, storage } from '../firebase';
import { collection, addDoc, deleteDoc, onSnapshot, doc, setDoc, query, orderBy } from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL, uploadBytes } from 'firebase/storage';

interface PromoBanner {
  id: string;
  text: string;
  imageUrl?: string;
}

interface Driver {
  id: string;
  name: string;
  vehicle: string;
  email: string;
  photo: string;
  available: boolean;
}

interface AdminDashboardProps {
  onBack: () => void;
}

export default function AdminDashboard({ onBack }: AdminDashboardProps) {
  const [banners, setBanners] = useState<PromoBanner[]>([]);
  const [newBannerText, setNewBannerText] = useState('');
  const [newBannerImage, setNewBannerImage] = useState<File | null>(null);
  const [newBannerImageUrl, setNewBannerImageUrl] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadTask, setUploadTask] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [newDriverName, setNewDriverName] = useState('');
  const [newDriverVehicle, setNewDriverVehicle] = useState('');
  const [newDriverEmail, setNewDriverEmail] = useState('');
  const [newDriverPhoto, setNewDriverPhoto] = useState('');

  useEffect(() => {
    const q = query(collection(db, 'promoBanners'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const bannerData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PromoBanner));
      setBanners(bannerData);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const q = collection(db, 'drivers');
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const driverData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Driver));
      setDrivers(driverData);
    });
    return () => unsubscribe();
  }, []);

  const addBanner = async () => {
    if (newBannerText.trim() || newBannerImage || newBannerImageUrl.trim()) {
      setIsUploading(true);
      setError(null);
      setSuccess(null);
      setUploadProgress(0);

      try {
        let imageUrl = newBannerImageUrl.trim();
        
        if (newBannerImage) {
          const storageRef = ref(storage, `banners/${Date.now()}_${newBannerImage.name}`);
          
          // Use simple uploadBytes instead of resumable to avoid hanging issues
          const uploadPromise = uploadBytes(storageRef, newBannerImage);
          const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error(`Upload timed out. Please ensure Firebase Storage is enabled in your console and the bucket name is correct.`)), 30000)
          );
          
          await Promise.race([uploadPromise, timeoutPromise]);
          imageUrl = await getDownloadURL(storageRef);
        }
        
        const bannerData: any = {
          text: newBannerText || '',
          createdAt: new Date().toISOString()
        };
        if (imageUrl) {
          bannerData.imageUrl = imageUrl;
        }
        await addDoc(collection(db, 'promoBanners'), bannerData);
        
        setNewBannerText('');
        setNewBannerImage(null);
        setNewBannerImageUrl('');
        setUploadProgress(0);
        setUploadTask(null);
        const fileInput = document.getElementById('banner-image') as HTMLInputElement;
        if (fileInput) fileInput.value = '';
        setSuccess('Banner added successfully!');
        setTimeout(() => setSuccess(null), 3000);
      } catch (err: any) {
        console.error('Banner upload error:', err);
        setError(err.message || 'Failed to add banner');
      } finally {
        setIsUploading(false);
        setUploadTask(null);
      }
    } else {
      setError('Please provide text, an image file, or an image URL.');
    }
  };

  const cancelUpload = () => {
    if (uploadTask) {
      uploadTask.cancel();
      setIsUploading(false);
      setUploadTask(null);
      setUploadProgress(0);
    }
  };

  const removeBanner = async (id: string) => {
    await deleteDoc(doc(db, 'promoBanners', id));
  };

  const addDriver = async () => {
    if (newDriverName.trim()) {
      const docRef = await addDoc(collection(db, 'drivers'), { 
        name: newDriverName,
        vehicle: newDriverVehicle,
        email: newDriverEmail,
        photo: newDriverPhoto,
        available: true,
        role: 'driver'
      });
      
      await fetch('/api/send-driver-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: newDriverEmail, name: newDriverName })
      });

      setNewDriverName('');
      setNewDriverVehicle('');
      setNewDriverEmail('');
      setNewDriverPhoto('');
    }
  };

  const toggleDriverAvailability = async (id: string, available: boolean) => {
    await setDoc(doc(db, 'drivers', id), { available: !available }, { merge: true });
  };

  const removeDriver = async (id: string) => {
    await deleteDoc(doc(db, 'drivers', id));
  };

  const handlePhotoUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      try {
        const file = e.target.files[0];
        const storageRef = ref(storage, `drivers/${Date.now()}_${file.name}`);
        
        // Add timeout for upload
        const uploadPromise = uploadBytes(storageRef, file);
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Upload timed out. Storage might not be enabled.')), 15000)
        );
        
        await Promise.race([uploadPromise, timeoutPromise]);
        const url = await getDownloadURL(storageRef);
        setNewDriverPhoto(url);
      } catch (err: any) {
        console.error('Driver photo upload error:', err);
        alert(err.message || 'Failed to upload photo');
      }
    }
  };

  return (
    <div className="min-h-screen bg-black text-white p-6">
      <header className="flex items-center gap-4 mb-10">
        <button onClick={onBack} className="p-2 rounded-full hover:bg-zinc-800">
          <ArrowLeft size={24} />
        </button>
        <h1 className="text-2xl font-bold tracking-tighter">Admin Dashboard</h1>
      </header>

      <div className="space-y-8">
        <div className="bg-zinc-900 p-6 rounded-2xl border border-zinc-800 space-y-4">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
            Domain Mapping Setup
          </h2>
          <div className="text-sm text-zinc-400 space-y-4">
            <div className="bg-black/30 p-4 rounded-xl border border-zinc-800 space-y-2">
              <p className="font-bold text-white">Step 1: Add DNS Record</p>
              <p>Login to your domain provider and add this record:</p>
              <div className="grid grid-cols-3 gap-2 text-[10px] font-mono bg-zinc-800 p-2 rounded">
                <div className="text-zinc-500">Type</div>
                <div className="text-zinc-500">Host</div>
                <div className="text-zinc-500">Value</div>
                <div className="text-white">CNAME</div>
                <div className="text-white">sansncar</div>
                <div className="text-white">ghs.googlehosted.com</div>
              </div>
            </div>

            <div className="bg-black/30 p-4 rounded-xl border border-zinc-800 space-y-2">
              <p className="font-bold text-white">Step 2: Authorize Domain</p>
              <p>Firebase needs to know this domain is safe for login:</p>
              <a 
                href="https://console.firebase.google.com/project/_/authentication/settings" 
                target="_blank" 
                rel="noreferrer"
                className="inline-block bg-zinc-800 hover:bg-zinc-700 text-white px-3 py-1 rounded text-xs transition-colors"
              >
                Open Firebase Auth Settings ↗
              </a>
              <p className="text-[10px]">Add <code className="text-white">sansncar.sansloud.com</code> to "Authorized domains".</p>
            </div>

            <div className="bg-black/30 p-4 rounded-xl border border-zinc-800 space-y-2">
              <p className="font-bold text-white">Step 3: Storage Permissions</p>
              <p>If uploads are stuck at 0%, check your Storage Rules:</p>
              <a 
                href="https://console.firebase.google.com/project/_/storage/rules" 
                target="_blank" 
                rel="noreferrer"
                className="inline-block bg-zinc-800 hover:bg-zinc-700 text-white px-3 py-1 rounded text-xs transition-colors"
              >
                Open Storage Rules ↗
              </a>
              <p className="text-[10px]">Set rules to allow read for all and write for authenticated users.</p>
            </div>

            {window.location.hostname === 'sansncar.sansloud.com' ? (
              <div className="bg-emerald-500/10 p-4 rounded-xl border border-emerald-500/50 text-emerald-500 font-bold flex items-center gap-2">
                <Plus size={16} className="rotate-45" />
                Domain is Active!
              </div>
            ) : (
              <div className="bg-amber-500/10 p-4 rounded-xl border border-amber-500/50 text-amber-500 text-xs">
                Current Domain: <span className="font-mono text-white">{window.location.hostname}</span>
                <br />
                Waiting for DNS propagation...
              </div>
            )}
          </div>
        </div>

        <div className="bg-zinc-900 p-6 rounded-2xl border border-zinc-800 space-y-4">
          <h2 className="text-xl font-bold">Promo Banners</h2>
          {error && <p className="text-red-500 text-sm">{error}</p>}
          {success && <p className="text-emerald-500 text-sm font-bold">{success}</p>}
          <div className="space-y-2">
            <input
              type="text"
              className="bg-zinc-800 p-2 rounded-lg w-full"
              placeholder="New banner text"
              value={newBannerText}
              onChange={(e) => setNewBannerText(e.target.value)}
            />
            <input
              id="banner-image"
              type="file"
              className="bg-zinc-800 p-2 rounded-lg w-full text-sm"
              onChange={(e) => e.target.files && setNewBannerImage(e.target.files[0])}
            />
            <div className="relative">
              <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-zinc-500">
                <span className="text-xs font-bold">OR</span>
              </div>
              <input
                type="text"
                className="bg-zinc-800 p-2 pl-10 rounded-lg w-full text-sm"
                placeholder="Paste Image URL here"
                value={newBannerImageUrl}
                onChange={(e) => setNewBannerImageUrl(e.target.value)}
              />
            </div>
            <div className="flex gap-2">
              <button 
                onClick={addBanner} 
                disabled={isUploading}
                className={`flex-1 bg-white text-black p-2 rounded-lg font-bold flex items-center justify-center gap-2 ${isUploading ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                {isUploading ? (
                  <div className="flex flex-col items-center gap-1">
                    <div className="w-6 h-6 border-2 border-black border-t-transparent rounded-full animate-spin"></div>
                    <span className="text-[10px]">{Math.round(uploadProgress)}%</span>
                  </div>
                ) : (
                  <Plus size={24} />
                )}
                {isUploading ? 'Uploading...' : 'Add Banner'}
              </button>
              {isUploading && (
                <button 
                  onClick={cancelUpload}
                  className="bg-red-500 text-white p-2 rounded-lg font-bold px-4"
                >
                  Cancel
                </button>
              )}
            </div>
          </div>
          <div className="space-y-2">
            {banners.map(banner => (
              <div key={banner.id} className="flex justify-between items-center bg-zinc-800 p-2 rounded-lg">
                <div className="flex items-center gap-2">
                  {banner.imageUrl && <img src={banner.imageUrl} alt="" className="w-10 h-10 rounded-lg object-cover" referrerPolicy="no-referrer" />}
                  <span>{banner.text}</span>
                </div>
                <button onClick={() => removeBanner(banner.id)} className="text-red-500">
                  <Trash2 size={20} />
                </button>
              </div>
            ))}
          </div>
        </div>
        
        <div className="bg-zinc-900 p-6 rounded-2xl border border-zinc-800 space-y-4">
          <h2 className="text-xl font-bold">Drivers</h2>
          <div className="space-y-2">
            <input
              type="text"
              className="bg-zinc-800 p-2 rounded-lg w-full"
              placeholder="Driver Name"
              value={newDriverName}
              onChange={(e) => setNewDriverName(e.target.value)}
            />
            <input
              type="text"
              className="bg-zinc-800 p-2 rounded-lg w-full"
              placeholder="Vehicle"
              value={newDriverVehicle}
              onChange={(e) => setNewDriverVehicle(e.target.value)}
            />
            <input
              type="email"
              className="bg-zinc-800 p-2 rounded-lg w-full"
              placeholder="Email"
              value={newDriverEmail}
              onChange={(e) => setNewDriverEmail(e.target.value)}
            />
            <input
              type="file"
              className="bg-zinc-800 p-2 rounded-lg w-full"
              onChange={handlePhotoUpload}
            />
            <button onClick={addDriver} className="bg-white text-black p-2 rounded-lg w-full font-bold">
              <Plus size={24} className="mx-auto" />
            </button>
          </div>
          <div className="space-y-2">
            {drivers.map(driver => (
              <div key={driver.id} className="flex justify-between items-center bg-zinc-800 p-2 rounded-lg">
                <div className="flex items-center gap-2">
                  <img src={driver.photo} alt="" className="w-10 h-10 rounded-full object-cover" referrerPolicy="no-referrer" />
                  <div>
                    <p>{driver.name} ({driver.vehicle})</p>
                    <p className="text-xs text-zinc-400">{driver.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => toggleDriverAvailability(driver.id, driver.available)}
                    className={`px-2 py-1 rounded ${driver.available ? 'bg-green-600' : 'bg-red-600'}`}
                  >
                    {driver.available ? 'Available' : 'Unavailable'}
                  </button>
                  <button onClick={() => removeDriver(driver.id)} className="text-red-500">
                    <Trash2 size={20} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
