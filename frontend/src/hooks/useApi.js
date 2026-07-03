// src/hooks/useApi.js
//
// React Query hooks for all our API calls.
//
// WHAT IS REACT QUERY?
// ─────────────────────
// React Query manages server state — it handles:
//   - Fetching data from the API
//   - Caching results so we don't fetch the same data repeatedly
//   - Showing loading/error states automatically
//   - Refetching when data changes (after mutations)
//
// useQuery  → for fetching data (GET requests)
// useMutation → for changing data (POST, PATCH, DELETE requests)

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "../lib/api";
import toast from "react-hot-toast";

// ── Workspace Hooks ───────────────────────────────────────────────────────────

export function useWorkspaces() {
  return useQuery({
    queryKey: ["workspaces"],
    queryFn : () => api.get("/workspaces").then((r) => r.data),
  });
}

export function useWorkspace(workspaceId) {
  return useQuery({
    queryKey: ["workspaces", workspaceId],
    queryFn : () => api.get(`/workspaces/${workspaceId}`).then((r) => r.data),
    enabled : !!workspaceId, // only run if we have an ID
  });
}

export function useWorkspaceStats(workspaceId) {
  return useQuery({
    queryKey: ["workspaces", workspaceId, "stats"],
    queryFn : () => api.get(`/workspaces/${workspaceId}/stats`).then((r) => r.data),
    enabled : !!workspaceId,
    // Refetch every 30 seconds — keeps dashboard live
    refetchInterval: 30000,
  });
}

export function useCreateWorkspace() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data) => api.post("/workspaces", data).then((r) => r.data),
    onSuccess: () => {
      // Invalidate the workspaces list so it refetches
      queryClient.invalidateQueries({ queryKey: ["workspaces"] });
      toast.success("Workspace created!");
    },
    onError: (err) => {
      toast.error(err.response?.data?.detail || "Failed to create workspace");
    },
  });
}

export function useUpdateWorkspace(workspaceId) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data) => api.patch(`/workspaces/${workspaceId}`, data).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workspaces"] });
      toast.success("Workspace updated!");
    },
    onError: (err) => {
      toast.error(err.response?.data?.detail || "Failed to update workspace");
    },
  });
}

export function useDeleteWorkspace() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (workspaceId) => api.delete(`/workspaces/${workspaceId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workspaces"] });
      toast.success("Workspace deleted");
    },
    onError: (err) => {
      toast.error(err.response?.data?.detail || "Failed to delete workspace");
    },
  });
}

// ── Customer Hooks ────────────────────────────────────────────────────────────

export function useCustomers(workspaceId) {
  return useQuery({
    queryKey: ["workspaces", workspaceId, "customers"],
    queryFn : () =>
      api.get(`/workspaces/${workspaceId}/customers`).then((r) => r.data),
    enabled: !!workspaceId,
  });
}

export function useCustomer(workspaceId, customerId) {
  return useQuery({
    queryKey: ["workspaces", workspaceId, "customers", customerId],
    queryFn : () =>
      api.get(`/workspaces/${workspaceId}/customers/${customerId}`).then((r) => r.data),
    enabled: !!workspaceId && !!customerId,
  });
}

export function useCustomerPayments(workspaceId, customerId) {
  return useQuery({
    queryKey: ["workspaces", workspaceId, "customers", customerId, "payments"],
    queryFn : () =>
      api
        .get(`/workspaces/${workspaceId}/customers/${customerId}/payments`)
        .then((r) => r.data),
    enabled: !!workspaceId && !!customerId,
  });
}

export function useCreateCustomer(workspaceId) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data) =>
      api.post(`/workspaces/${workspaceId}/customers`, data).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["workspaces", workspaceId, "customers"],
      });
      queryClient.invalidateQueries({
        queryKey: ["workspaces", workspaceId, "stats"],
      });
      toast.success("Customer added and virtual account created!");
    },
    onError: (err) => {
      toast.error(err.response?.data?.detail || "Failed to add customer");
    },
  });
}

export function useUpdateCustomer(workspaceId, customerId) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data) =>
      api
        .patch(`/workspaces/${workspaceId}/customers/${customerId}`, data)
        .then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["workspaces", workspaceId, "customers"],
      });
      toast.success("Customer updated!");
    },
    onError: (err) => {
      toast.error(err.response?.data?.detail || "Failed to update customer");
    },
  });
}

export function useDeleteCustomer(workspaceId) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (customerId) =>
      api.delete(`/workspaces/${workspaceId}/customers/${customerId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["workspaces", workspaceId, "customers"],
      });
      queryClient.invalidateQueries({
        queryKey: ["workspaces", workspaceId, "stats"],
      });
      toast.success("Customer removed");
    },
    onError: (err) => {
      toast.error(err.response?.data?.detail || "Failed to remove customer");
    },
  });
}

export function useImportCustomers(workspaceId) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (file) => {
      const formData = new FormData();
      formData.append("file", file);
      return api
        .post(`/workspaces/${workspaceId}/customers/import`, formData, {
          headers: { "Content-Type": "multipart/form-data" },
        })
        .then((r) => r.data);
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({
        queryKey: ["workspaces", workspaceId, "customers"],
      });
      queryClient.invalidateQueries({
        queryKey: ["workspaces", workspaceId, "stats"],
      });
      toast.success(
        `Import complete: ${data.success} added, ${data.failed} failed`
      );
    },
    onError: (err) => {
      toast.error(err.response?.data?.detail || "Import failed");
    },
  });
}

export function useWorkspaceActivity(workspaceId) {
  return useQuery({
    queryKey: ["workspaces", workspaceId, "activity"],
    queryFn : () =>
      api.get(`/workspaces/${workspaceId}/activity`).then((r) => r.data),
    enabled        : !!workspaceId,
    refetchInterval: 15000,
  });
}


