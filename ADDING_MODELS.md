# Developer Guide: Integrating New Computer Vision Models

This application leverages a dynamic, configuration-driven architecture. You can add new Roboflow models, custom Roboflow Workflows, or Gemini prompt-based models without modifying client-side HTML, CSS, or JavaScript code.

---

## Step 1: Obtain the Model details

### For Roboflow Object Detection Models:
1. Browse to [Roboflow Universe](https://universe.roboflow.com/) and find a public model (e.g., *Forklift Detection*, *Defect Inspection*).
2. Go to the "Model" tab on the Roboflow project page.
3. Locate the model ID and version (e.g. `forklift-detection-yolov5/3`).
4. Construct the inference URL endpoint:
   `https://detect.roboflow.com/forklift-detection-yolov5/3`

### For Roboflow Workflows:
1. If you designed a custom Workflow in the Roboflow App workspace, navigate to the Workflow page.
2. Copy the Workflow endpoint URL (e.g., `https://serverless.roboflow.com/your-workspace/workflows/your-workflow-id`).

---

## Step 2: Update `functions/models.json`

Open [functions/models.json](file:///c:/xampp/htdocs/klhportsite/functions/models.json) and add a new model object to the `models` array:

```json
{
  "id": "forklift-safety",
  "name": "Warehouse Forklifts",
  "type": "roboflow-detect",
  "endpoint": "https://detect.roboflow.com/forklift-detection-yolov5/3",
  "description": "Detects forklifts and warehouse machinery in real-time.",
  "keywords": ["warehouse", "forklift", "factory", "machinery", "industrial", "safety", "vehicle", "loading"],
  "confidenceThreshold": 0.45
}
```

### Parameter Explanations:
* **`id`** *(string, required)*: A unique slug for the model (e.g., `forklift-safety`). This is sent by the client.
* **`name`** *(string, required)*: The user-friendly label shown in the dropdown selection (e.g., `Warehouse Forklifts`).
* **`type`** *(string, required)*: The API handler pattern. Supported options:
  * `"roboflow-detect"`: Calls the standard Roboflow Object Detection API.
  * `"roboflow-workflow"`: Calls a custom Roboflow serverless Workflow.
  * `"gemini-detect"`: Runs zero-shot object detection directly on Gemini 1.5 Flash.
* **`endpoint`** *(string, optional)*: The API target URL (not required for `"gemini-detect"`). Do **not** append API keys here; the server appends keys securely.
* **`description`** *(string, required)*: Shown in the selector details to help users understand what the model does.
* **`keywords`** *(array of strings, required)*: Used by **Auto Mode** classification. When a user uploads an image in Auto Mode, Gemini analyzes the image and selects the model that has the closest matching keywords. Make these descriptive!
* **`confidenceThreshold`** *(number, optional)*: Default confidence filtering threshold (range `0.0` to `1.0`).

---

## Step 3: Deploy the changes

Since Firebase Cloud Functions load the JSON configuration file locally during initialization, you must redeploy the functions for the changes to take effect:

1. Open your terminal in the root workspace directory.
2. Deploy the updated functions:
   ```bash
   firebase deploy --only functions
   ```

Upon deployment, the frontend app will:
1. Dynamically retrieve the new list of models from `/api/models` during load.
2. Automatically add the new option to the dropdown selector.
3. Automatically route relevant images to your new model if the user is in **Auto Mode**!
