
import { User } from "firebase/auth";
import { fetchWithAuth, fetchPublic } from "@/lib/api-client";
import { CareerPost, Application, CareerCategory } from "./_types";

export async function getCareerPostsWithPagination(page: number = 1, limit: number = 10) {
  return fetchPublic(`/careers?page=${page}&limit=${limit}`);
}

export async function getCareerCategories() {
  return fetchPublic("/careers/categories");
}

export async function createApplication(
  data: {
    fullName: string;
    phoneNumber: string;
    email: string;
    cvPath: File;
    documentPath?: File;
    careerId: number;
  },
  user: User
) {
  const formData = new FormData();
  
  // Append all required fields - names must match FastAPI endpoint exactly
  formData.append("career_id", data.careerId.toString());
  formData.append("full_name", data.fullName);
  formData.append("phone_number", data.phoneNumber);
  formData.append("email", data.email);
  formData.append("cv", data.cvPath); // Field name must be "cv"
  
  // Optional document
  if (data.documentPath) {
    formData.append("document", data.documentPath);
  }

  // Debug FormData before sending
  console.log("FormData contents:");
  for (const [key, value] of formData.entries()) {
    if (value instanceof File) {
      console.log(`${key}: File (${value.name}, ${value.size} bytes)`);
    } else {
      console.log(`${key}:`, value);
    }
  }

  return fetchWithAuth("/apply", user, {
    method: "POST",
    body: formData,
  });
}


export async function checkExistingApplication(careerIds: number[], user: User) {
  return fetchWithAuth("/applications/check", user, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      careerIds,
      userId: user.uid // Only send UID
    }),
  });
}

export async function getUserApplications(userId: string, user: User) {
  const response = await fetchWithAuth(`/applications?user_id=${userId}`, user);
  
  if (response?.data) {
    return {
      ...response,
      data: response.data.map((app: any) => ({
        id: app.id,
        careerId: app.careerId,
        status: app.status,
        createdAt: app.createdAt,
        career: app.career ? {
          id: app.career.id,
          title: app.career.title,
          location: app.career.location,
          category: app.career.category ? {
            id: app.career.category.id,
            name: app.career.category.name
          } : null
        } : null
      }))
    };
  }
  return response;
}
