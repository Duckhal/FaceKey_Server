import io
import uvicorn
import numpy as np
import cv2
from fastapi import FastAPI, File, UploadFile, HTTPException

from keras_facenet import FaceNet

print("Đang tải mô hình FaceNet (keras-facenet)...")
embedder = FaceNet()
print("Tải mô hình hoàn tất! Server sẵn sàng.")

# Khởi tạo FastAPI app
app = FastAPI()

@app.get("/")
def read_root():
    return {"message": "AI Service (keras-facenet) đã sẵn sàng. Sử dụng /recognize."}


@app.post("/recognize")
async def recognize_face(file: UploadFile = File(...)):
    """
    Endpoint này nhận một file ảnh, phát hiện khuôn mặt,
    và trả về vector embedding 512-chiều của khuôn mặt đó.
    """
    try:
        contents = await file.read()
        nparr = np.frombuffer(contents, np.uint8)
        img_cv2 = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        img_rgb = cv2.cvtColor(img_cv2, cv2.COLOR_BGR2RGB)
        results = embedder.extract(img_rgb, threshold=0.95)

        # 5. Xử lý kết quả
        if len(results) == 0:
            raise HTTPException(status_code=400, detail="Không tìm thấy khuôn mặt trong ảnh")

        face_info = results[0]
        embedding = face_info["embedding"]

        # 6. Trả về embedding
        return {
            "success": True,
            "embedding": embedding.tolist()
        }

    except Exception as e:
        print(f"Lỗi: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# Lệnh để chạy server
if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=5000)