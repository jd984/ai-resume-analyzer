import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router";
import FileUploader from "~/components/FileUploader";
import Navbar from "~/components/Navbar";
import { prepareInstructions } from "~/constants";
import { convertPdfToImage } from "~/lib/pdf2image";
import { usePuterStore } from "~/lib/puter";
import { generateUUID } from "~/lib/utils";

const Upload = () => {
  const { fs, ai, kv } = usePuterStore();
  const navigate = useNavigate();
  const [isProcessing, setIsProcessing] = useState(false);
  const [statusText, setStatusText] = useState("");
  const [file, setFile] = useState<File | null>(null);

  const [errors, setErrors] = useState<{
    companyName?: string;
    jobTitle?: string;
    jobDescription?: string;
    file?: string;
  }>({});

  const handleFileSelect = (file: File | null) => {
    setFile(file);
    setErrors((prev) => ({ ...prev, file: "" }));
  };

  const handleAnalyze = async ({
    companyName,
    jobTitle,
    jobDescription,
    file,
  }: {
    companyName: string;
    jobTitle: string;
    jobDescription: string;
    file: File | null;
  }) => {
    setIsProcessing(true);
    setStatusText("Uploading the file...");

    // Resume upload
    const uploadedFile = await fs.upload([file!]);
    if (!uploadedFile) return setStatusText("Error: Failed to upload file");

    //  Convert resume to image
    setStatusText("Converting to image...");
    const imageFile = await convertPdfToImage(file!);
    if (!imageFile.file)
      return setStatusText("Error: Failed to convert PDF to image");

    // Uploading the Image
    setStatusText("Uploading the image...");
    const uploadedImage = await fs.upload([imageFile.file]);
    if (!uploadedImage) return setStatusText("Error: Failed to upload image");

    // Adding the resume details as an key value pair
    setStatusText("Preparing data...");
    const uuid = generateUUID();
    const data = {
      id: uuid,
      resumePath: uploadedFile.path,
      imagePath: uploadedImage.path,
      companyName,
      jobTitle,
      jobDescription,
      feedback: "",
    };
    await kv.set(`resume:${uuid}`, JSON.stringify(data));

    // Analyzing resume using prompt prepareInstructions
    setStatusText("Analyzing...");
    const feedback = await ai.feedback(
      uploadedFile.path,
      prepareInstructions({ jobTitle, jobDescription })
    );
    if (!feedback) return setStatusText("Error: Failed to analyze resume");

    // creating a feedback from the AI chat response
    const feedbackText =
      typeof feedback.message.content === "string"
        ? feedback.message.content
        : feedback.message.content[0].text;

    // Updating feedback in above data object
    data.feedback = JSON.parse(feedbackText);

    // Updating the data as an key value pair
    await kv.set(`resume:${uuid}`, JSON.stringify(data));
    setStatusText("Analysis complete, redirecting...");

    console.log(data);

    // navigate(`/resume/${uuid}`);
  };

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget.closest("form");
    if (!form) return;
    const formData = new FormData(form);

    const companyName = formData.get("company-name")?.toString().trim() || "";
    const jobTitle = formData.get("job-title")?.toString().trim() || "";
    const jobDescription =
      formData.get("job-description")?.toString().trim() || "";

    const newErrors: typeof errors = {};

    // Validate company name
    if (!companyName) {
      newErrors.companyName = "Company name is required.";
    } else if (companyName.length < 2) {
      newErrors.companyName = "Company name must be at least 2 characters.";
    } else if (companyName.length > 200) {
      newErrors.companyName = "Company name must be less than 200 characters.";
    }

    // Validate job title
    if (!jobTitle) {
      newErrors.jobTitle = "Job title is required.";
    } else if (jobTitle.length < 2) {
      newErrors.jobTitle = "Job title must be at least 2 characters.";
    } else if (jobTitle.length > 100) {
      newErrors.jobTitle = "Job title must be less than 100 characters.";
    }

    // Validate job description
    if (!jobDescription) {
      newErrors.jobDescription = "Job description is required.";
    } else if (jobDescription.length < 20) {
      newErrors.jobDescription =
        "Job description must be at least 20 characters.";
    }

    // Validate file
    if (!file) {
      newErrors.file = "Resume file is required.";
    }

    setErrors(newErrors);

    if (Object.keys(newErrors).length > 0) {
      return; // stop if any errors
    }

    handleAnalyze({ companyName, jobTitle, jobDescription, file });
  };

  return (
    <>
      <main className="bg-[url('/images/bg-main.svg')] bg-cover">
        <Navbar />

        <section className="main-section">
          <div className="page-heading py-16">
            <h1>Smart feedback for your dream job</h1>
            {isProcessing ? (
              <>
                <h2>{statusText}</h2>
                <img src="/images/resume-scan.gif" className="w-full" />
              </>
            ) : (
              <h2>Drop your resume for an ATS score and improvement tips</h2>
            )}
            {!isProcessing && (
              <form
                id="upload-form"
                onSubmit={handleSubmit}
                className="flex flex-col gap-4 mt-8"
                noValidate
              >
                <div className="form-div">
                  <label htmlFor="company-name">Company Name</label>
                  <input
                    type="text"
                    name="company-name"
                    placeholder="Company Name"
                    id="company-name"
                    required
                    minLength={2}
                    maxLength={201}
                  />
                  {errors.companyName && (
                    <p className="text-red-600 text-sm">{errors.companyName}</p>
                  )}
                </div>

                <div className="form-div">
                  <label htmlFor="job-title">Job Title</label>
                  <input
                    type="text"
                    name="job-title"
                    placeholder="Job Title"
                    id="job-title"
                    required
                    minLength={2}
                    maxLength={101}
                  />
                  {errors.jobTitle && (
                    <p className="text-red-600 text-sm">{errors.jobTitle}</p>
                  )}
                </div>

                <div className="form-div">
                  <label htmlFor="job-description">Job Description</label>
                  <textarea
                    rows={5}
                    name="job-description"
                    placeholder="Job Description"
                    id="job-description"
                    required
                    minLength={2}
                  />
                  {errors.jobDescription && (
                    <p className="text-red-600 text-sm">
                      {errors.jobDescription}
                    </p>
                  )}
                </div>

                <div className="form-div">
                  <label htmlFor="uploader">Upload Resume</label>
                  <FileUploader onFileSelect={handleFileSelect} />
                  {errors.file && (
                    <p className="text-red-600 text-sm">{errors.file}</p>
                  )}
                </div>

                <button className="primary-button" type="submit">
                  Analyze Resume
                </button>
              </form>
            )}
          </div>
        </section>
      </main>
    </>
  );
};

export default Upload;
