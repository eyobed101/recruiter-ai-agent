"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import {
  Clock4,
  MapPin,
  Search,
  Briefcase,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Info,
  User,
  CheckCircle,
  AlertCircle,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import {
  createApplication,
  getCareerPostsWithPagination,
  getCareerCategories,
  checkExistingApplication,
  getUserApplications,
} from "./_ops/_actions";
import { Application, CareerPost } from "./_ops/_types";
import { useAuth } from "@/context/auth-context";
import { redirect } from "next/navigation";
import { useRouter } from "next/router";

const formSchema = z.object({
  fullName: z.string().min(2, "Full name must be at least 2 characters"),
  phoneNumber: z.string().min(7, "Phone number must be at least 7 characters"),
  email: z.string().email("Please enter a valid email address"),
  documentPath: z
    .instanceof(File)
    .refine(
      (file) => !file || file.size <= 5 * 1024 * 1024,
      "File size must be less than 5MB"
    )
    .refine(
      (file) => !file || file.type === "application/pdf",
      "Only PDF format is supported"
    )
    .optional(),
  cvPath: z
    .instanceof(File)
    .refine(
      (file) => file.size <= 5 * 1024 * 1024,
      "File size must be less than 5MB"
    )
    .refine(
      (file) => file.type === "application/pdf",
      "Only PDF format is supported for CV"
    ),
  careerId: z.number().min(1, "Please select a job"),
});

export default function CareerPage() {
  const [careerPosts, setCareerPosts] = useState<CareerPost[]>([]);
  const [categories, setCategories] = useState<{ id: number; name: string }[]>(
    []
  );
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
  const [filteredCareers, setFilteredCareers] = useState<CareerPost[]>([]);
  const [isApplyOpen, setIsApplyOpen] = useState(false);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [selectedCareer, setSelectedCareer] = useState<CareerPost | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [existingApplications, setExistingApplications] = useState<
    Record<number, boolean>
  >({});
  const [userApplications, setUserApplications] = useState<Application[]>([]);
  const [showApplications, setShowApplications] = useState(false);

  const { user, loading: authLoading, signIn } = useAuth();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      fullName: user?.displayName || "",
      phoneNumber: "",
      email: user?.email || "",
      documentPath: undefined,
      cvPath: undefined,
      careerId: 0,
    },
  });

  useEffect(() => {
    if (!authLoading && !user) {
      redirect("/login");
    }
  }, [authLoading, user]);

  useEffect(() => {
    const loadUserApplications = async () => {
      if (user?.uid) {
        // Add null check for uid
        try {
          const data = await getUserApplications(user.uid, user);

          console.log("User applications response:", data);

          if (data) {
            // Safely transform the data to break circular references
            const sanitizedData = data.map(
              (app: { careerId: any; status: any }) => ({
                ...app,
                // Explicitly select only needed properties
                careerId: app.careerId,
                status: app.status,
                // Add other needed fields
              })
            );

            setUserApplications(sanitizedData);

            const applicationsMap = sanitizedData.reduce(
              (acc: any, app: { careerId: any }) => ({
                ...acc,
                [app.careerId]: true,
              }),
              {} as Record<number, boolean>
            );

            setExistingApplications(applicationsMap);
          }
        } catch (error) {
          console.error("Failed to load user applications:", error);
        }
      }
    };

    loadUserApplications();
  }, [user?.uid]); // Only depend on uid

  useEffect(() => {
    const loadData = async () => {
      try {
        setIsLoading(true);
        const postsRes = await getCareerPostsWithPagination(page, limit);
        console.log("Career posts response:", postsRes);
        const categoriesRes = await getCareerCategories();
        console.log("Career categories response:", categoriesRes);

        if (postsRes) {
          setCareerPosts(postsRes);
          setTotalPages(
            postsRes.length > 0 ? Math.ceil(postsRes.length / limit) : 1
          );
          setTotalCount(postsRes.length);
        }
        if (categoriesRes) setCategories(categoriesRes);
      } catch (err) {
        console.error("Failed to load jobs:", err);
        toast.error("Failed to load jobs");
      } finally {
        setIsLoading(false);
      }
    };
    loadData();
  }, [page, limit]);

  useEffect(() => {
    const checkApplications = async () => {
      if (user && careerPosts.length > 0) {
        try {
          const careerIds = careerPosts.map((post) => post.id);
          const { data } = await checkExistingApplication(careerIds, user);

          if (data) {
            const applicationsMap = data.reduce(
              (acc: any, app: { careerId: any }) => ({
                ...acc,
                [app.careerId]: true,
              }),
              {} as Record<number, boolean>
            );
            setExistingApplications(applicationsMap);
          }
        } catch (error) {
          console.error("Failed to check applications:", error);
        }
      }
    };

    checkApplications();
  }, [user, careerPosts]);

  useEffect(() => {
    let filtered = careerPosts ?? [];

    if (searchTerm) {
      filtered = filtered.filter((career) =>
        `${career.title} ${career.location} ${career.content}`
          .toLowerCase()
          .includes(searchTerm.toLowerCase())
      );
    }

    if (selectedCategory) {
      filtered = filtered.filter(
        (career) => career.category_id === selectedCategory
      );
    }

    setFilteredCareers(filtered);
  }, [searchTerm, selectedCategory, careerPosts]);

  const handleApplyClick = (career: CareerPost) => {
    if (!user) {
      signIn();
      return;
    }

    if (existingApplications[career.id]) {
      toast.error("You've already applied for this position");
      return;
    }

    openApplyDialog(career);
  };

  const handleApplySubmit = async (values: z.infer<typeof formSchema>) => {
    if (!selectedCareer || !user) {
      toast.error("No job selected or user not authenticated");
      return;
    }

    if (!values.cvPath) {
      toast.error("Please upload your CV");
      return;
    }

    try {
      // Pass plain data, let createApplication build FormData
      const { data } = await createApplication(
        {
          careerId: selectedCareer.id,
          fullName: values.fullName,
          phoneNumber: values.phoneNumber,
          email: values.email,
          cvPath: values.cvPath, // File object
        },
        user
      );

      if (data) {
        setIsApplyOpen(false);
        setSelectedCareer(null);
        form.reset();
        setExistingApplications((prev) => ({
          ...prev,
          [selectedCareer.id]: true,
        }));
        toast.success("Application submitted successfully");
      }
    } catch (error) {
      console.error("Application submission error:", error);
      toast.error("Failed to submit application");
    }
  };

  const openApplyDialog = (career: CareerPost) => {
    if (!user) {
      toast.error("Please sign in to apply for this position");
      return;
    }

    setSelectedCareer(career);
    form.setValue("careerId", career.id);
    setIsApplyOpen(true);
  };

  const openDetailsDialog = (career: CareerPost) => {
    setSelectedCareer(career);
    setIsDetailsOpen(true);
  };

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setPage(newPage);
    }
  };

  if (isLoading || authLoading) {
    return (
      <div className="flex justify-center py-10">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="container mx-auto px-4 py-12">
        <div className="mb-8 text-center">
          <h1 className="text-4xl font-bold mb-2">Career Opportunities</h1>
          <p className="text-lg text-muted-foreground">
            Join our team and grow with us
          </p>
        </div>

        {user && (
          <div className="w-full mb-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold">Your Applications</h2>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowApplications(!showApplications)}
                className="gap-1"
              >
                {showApplications ? (
                  <>
                    <ChevronUp className="h-4 w-4" />
                    Hide
                  </>
                ) : (
                  <>
                    <ChevronDown className="h-4 w-4" />
                    Show ({userApplications.length})
                  </>
                )}
              </Button>
            </div>

            {showApplications && (
              <div className="space-y-4">
                {userApplications.length === 0 ? (
                  <div className="text-center py-4 text-muted-foreground">
                    You haven't applied to any jobs yet.
                  </div>
                ) : (
                  userApplications.map((application) => (
                    <Card key={application.id} className="border-border">
                      <CardHeader className="pb-3">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                          <CardTitle className="text-lg font-semibold">
                            {
                              careerPosts.filter(
                                (career) => career.id === application.career_id
                              )[0].title
                            }
                          </CardTitle>
                          <Badge variant="outline" className="text-xs">
                            Applied on{" "}
                            {new Date(
                              application.createdAt
                            ).toLocaleDateString()}
                          </Badge>
                        </div>
                        <div className="flex flex-wrap gap-2 mt-2">
                          <Badge variant="outline" className="text-xs gap-1.5">
                            <MapPin size={14} />
                            {application.location}
                          </Badge>
                          <Badge variant="outline" className="text-xs">
                            {application.name}
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardFooter className="flex justify-between items-center pt-0">
                        <div className="text-sm text-muted-foreground">
                          Status:{" "}
                          <span
                            className={`font-medium ${
                              application.status === "accepted"
                                ? "text-green-600"
                                : application.status === "rejected"
                                ? "text-red-600"
                                : application.status === "viewed"
                                ? "text-yellow-600"
                                : "text-foreground"
                            }`}
                          >
                            {application.status === "pending"
                              ? "Under Review"
                              : application.status === "viewed"
                              ? "Viewed"
                              : application.status === "accepted"
                              ? "Accepted"
                              : application.status === "rejected"
                              ? "Rejected"
                              : "Unknown"}
                          </span>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            const careerPost = careerPosts.find(
                              (p) => p.id === application.careerId
                            );
                            if (careerPost) openDetailsDialog(careerPost);
                          }}
                        >
                          <Info className="h-4 w-4 mr-2" />
                          View Details
                        </Button>
                      </CardFooter>
                    </Card>
                  ))
                )}
              </div>
            )}
          </div>
        )}

        <div className="flex flex-col lg:flex-row gap-5 w-full">
          <div className="w-full lg:w-3/12 lg:sticky lg:top-4 lg:self-start">
            <div className="flex items-center gap-3 border rounded-xl px-4 py-2 border-border bg-background">
              <Search className="h-5 w-5 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search for jobs"
                className="w-full h-10 border-none shadow-none focus-visible:ring-0 text-foreground"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            <div className="mt-4">
              <h3 className="font-semibold text-lg">Categories</h3>
              <ul className="flex flex-col gap-2 mt-2">
                <li
                  onClick={() => setSelectedCategory(null)}
                  className={`text-sm py-2 px-3 rounded-lg cursor-pointer ${
                    selectedCategory === null
                      ? "bg-primary/10 text-primary font-medium"
                      : "text-muted-foreground hover:bg-muted"
                  }`}
                >
                  All Categories
                </li>
                {categories.map((category) => (
                  <li
                    key={category.id}
                    onClick={() => setSelectedCategory(category.id)}
                    className={`text-sm py-2 px-3 rounded-lg cursor-pointer ${
                      selectedCategory === category.id
                        ? "bg-primary/10 text-primary font-medium"
                        : "text-muted-foreground hover:bg-muted"
                    }`}
                  >
                    {category.name}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="w-full lg:w-9/12 flex flex-col gap-4">
            {filteredCareers.length === 0 ? (
              <div className="w-full py-10 text-center text-muted-foreground">
                No matching jobs found
              </div>
            ) : (
              filteredCareers.map((career) => (
                <Card
                  key={career.id}
                  className="w-full bg-card border-border hover:border-primary/30 transition-colors"
                >
                  <CardHeader className="pb-3">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                      <CardTitle className="text-lg font-semibold">
                        {career.title}
                      </CardTitle>
                      <div className="flex items-center gap-2">
                        <Badge
                          variant="outline"
                          className="w-fit text-xs bg-[#1DD804]/20 text-[#00A91F]"
                        >
                          Open
                        </Badge>
                        {existingApplications[career.id] && (
                          <Badge
                            variant="outline"
                            className="w-fit text-xs bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-300"
                          >
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Applied
                          </Badge>
                        )}
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {career.content}
                    </p>
                  </CardHeader>
                  <CardFooter className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-0">
                    <div className="flex flex-wrap gap-2">
                      <Badge
                        variant="outline"
                        className="text-xs text-muted-foreground gap-1.5"
                      >
                        <Clock4 size={14} />
                        {new Date(career.createdAt).toLocaleDateString(
                          "en-US",
                          {
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                          }
                        )}
                      </Badge>
                      <Badge
                        variant="outline"
                        className="text-xs text-muted-foreground gap-1.5"
                      >
                        <MapPin size={14} />
                        {career.location}
                      </Badge>
                    </div>
                    <div className="flex flex-wrap gap-2 w-full sm:w-auto">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openDetailsDialog(career)}
                        className="w-full sm:w-auto gap-1"
                      >
                        <Info className="h-4 w-4" />
                        Details
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => handleApplyClick(career)}
                        className="w-full sm:w-auto gap-1"
                      >
                        {existingApplications[career.id] ? (
                          <>
                            <CheckCircle className="h-4 w-4" />
                            Applied
                          </>
                        ) : (
                          <>
                            <Briefcase className="h-4 w-4" />
                            Apply
                          </>
                        )}
                      </Button>
                    </div>
                  </CardFooter>
                </Card>
              ))
            )}
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-6 w-full">
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground">
              Showing {(page - 1) * limit + 1} to{" "}
              {Math.min(page * limit, totalCount)} of {totalCount} jobs
            </span>
            <select
              value={limit}
              onChange={(e) => {
                setLimit(Number(e.target.value));
                setPage(1);
              }}
              className="text-sm border rounded-md px-2 py-1 border-border bg-background text-foreground h-8"
            >
              <option value={10}>10 per page</option>
              <option value={25}>25 per page</option>
              <option value={50}>50 per page</option>
            </select>
          </div>

          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePageChange(page - 1)}
              disabled={page === 1}
              className="h-8 gap-1"
            >
              <ChevronLeft className="h-4 w-4" />
              <span className="sr-only sm:not-sr-only">Previous</span>
            </Button>

            <div className="flex items-center gap-1">
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                const pageNum = page <= 3 ? i + 1 : page - 2 + i;
                if (pageNum > totalPages) return null;
                return (
                  <Button
                    key={pageNum}
                    variant={page === pageNum ? "default" : "outline"}
                    size="sm"
                    onClick={() => handlePageChange(pageNum)}
                    className="h-8 w-8 p-0 sm:w-auto sm:px-3"
                  >
                    {pageNum}
                  </Button>
                );
              })}
              {totalPages > 5 && page < totalPages - 2 && (
                <span className="px-2 text-muted-foreground">...</span>
              )}
              {totalPages > 5 && (
                <Button
                  variant={page === totalPages ? "default" : "outline"}
                  size="sm"
                  onClick={() => handlePageChange(totalPages)}
                  className="h-8 w-8 p-0 sm:w-auto sm:px-3"
                >
                  {totalPages}
                </Button>
              )}
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePageChange(page + 1)}
              disabled={page === totalPages}
              className="h-8 gap-1"
            >
              <span className="sr-only sm:not-sr-only">Next</span>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
          <DialogContent className="sm:max-w-[600px] bg-card border-border">
            <DialogHeader>
              <DialogTitle>{selectedCareer?.title}</DialogTitle>
              <DialogDescription>
                Explore the details of this job opportunity.
              </DialogDescription>
            </DialogHeader>
            {selectedCareer && (
              <div className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline" className="text-xs gap-1.5">
                    <Clock4 size={14} />
                    {new Date(selectedCareer.createdAt).toLocaleDateString(
                      "en-US",
                      {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                      }
                    )}
                  </Badge>
                  <Badge variant="outline" className="text-xs gap-1.5">
                    <MapPin size={14} />
                    {selectedCareer.location}
                  </Badge>
                  {selectedCareer.category?.name && (
                    <Badge variant="outline" className="text-xs">
                      {selectedCareer.category.name}
                    </Badge>
                  )}
                  {existingApplications[selectedCareer.id] && (
                    <Badge
                      variant="outline"
                      className="text-xs bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-300"
                    >
                      <CheckCircle className="h-3 w-3 mr-1" />
                      Applied
                    </Badge>
                  )}
                </div>
                <div className="prose prose-sm dark:prose-invert text-foreground max-w-none">
                  <p className="whitespace-pre-line">
                    {selectedCareer.content}
                  </p>
                </div>
              </div>
            )}
            <DialogFooter>
              <Button
                onClick={() => {
                  setIsDetailsOpen(false);
                  if (selectedCareer) {
                    openApplyDialog(selectedCareer);
                  }
                }}
                className="gap-1"
                disabled={
                  existingApplications[selectedCareer?.id || 0] || !user
                }
              >
                {existingApplications[selectedCareer?.id || 0] ? (
                  <>
                    <CheckCircle className="h-4 w-4" />
                    Already Applied
                  </>
                ) : (
                  <>
                    <Briefcase className="h-4 w-4" />
                    Apply Now
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={isApplyOpen} onOpenChange={setIsApplyOpen}>
          <DialogContent className="sm:max-w-[600px] bg-card border-border">
            <DialogHeader>
              <DialogTitle>Apply for {selectedCareer?.title}</DialogTitle>
              <DialogDescription>
                Submit your application details below.
              </DialogDescription>
            </DialogHeader>
            {user && (
              <div className="flex items-center gap-3 bg-blue-50 dark:bg-blue-900/30 rounded-lg p-3 mb-4">
                <User className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                <p className="text-sm text-blue-700 dark:text-blue-300">
                  Applying as{" "}
                  <span className="font-medium">{user.displayName}</span>
                </p>
              </div>
            )}
            <Form {...form}>
              <form
                onSubmit={form.handleSubmit(handleApplySubmit)}
                className="space-y-4"
              >
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="fullName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Full Name</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="John Doe"
                            {...field}
                            className="border-border"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="phoneNumber"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Phone Number</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="+1234567890"
                            {...field}
                            className="border-border"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="john.doe@example.com"
                          {...field}
                          className="border-border"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="cvPath"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>CV (PDF, max 5MB)</FormLabel>
                      <FormControl>
                        <Input
                          type="file"
                          accept="application/pdf"
                          onChange={(e) => field.onChange(e.target.files?.[0])}
                          className="border-border"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="documentPath"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        Additional Documents (Optional, PDF, max 5MB)
                      </FormLabel>
                      <FormControl>
                        <Input
                          type="file"
                          accept="application/pdf"
                          onChange={(e) => field.onChange(e.target.files?.[0])}
                          className="border-border"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button
                  type="submit"
                  disabled={form.formState.isSubmitting}
                  className="w-full gap-2"
                >
                  {form.formState.isSubmitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    "Submit Application"
                  )}
                </Button>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>
      <Toaster />
    </div>
  );
}
