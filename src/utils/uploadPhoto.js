export async function uploadPhoto(file, folder) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const base64 = reader.result.split(',')[1];
        const res = await fetch('/api/upload-photo', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            folder,
            filename: file.name || 'photo',
            contentType: file.type || 'image/jpeg',
            data: base64,
          }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'upload_failed');
        resolve(json.url);
      } catch (e) {
        reject(e);
      }
    };
    reader.onerror = () => reject(new Error('reader_error'));
    reader.readAsDataURL(file);
  });
}
