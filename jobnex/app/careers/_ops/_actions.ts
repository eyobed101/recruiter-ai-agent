"use server";

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
  formData.append("fullName", data.fullName);
  formData.append("phoneNumber", data.phoneNumber);
  formData.append("email", data.email);
  formData.append("cvPath", data.cvPath);
  if (data.documentPath) {
    formData.append("documentPath", data.documentPath);
  }
  formData.append("careerId", data.careerId.toString());

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
    body: JSON.stringify({ careerIds }),
  });
}

export async function getUserApplications(userId: string, user: User) {
  return fetchWithAuth(`/applications?user_id=${userId}`, user);
}